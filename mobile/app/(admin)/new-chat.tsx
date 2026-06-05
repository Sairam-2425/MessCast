import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GlassInput } from '../../components/ui/GlassInput';
import { NeonButton } from '../../components/ui/NeonButton';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import api from '../../lib/axios';

interface UserResult {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
}

type Tab = 'direct' | 'group' | 'broadcast';

// Extracted & memoised so FlatList only re-renders the row whose isSelected changed.
// Custom areEqual: skip re-render when item identity and selection state are unchanged.
// onToggle is excluded from comparison — it is always a stable useCallback ref.
interface GroupRowProps {
  item: UserResult;
  isSelected: boolean;
  onToggle: (user: UserResult) => void;
}
const GroupUserRow = memo(
  function GroupUserRow({ item, isSelected, onToggle }: GroupRowProps) {
    return (
      <TouchableOpacity style={styles.userRow} onPress={() => onToggle(item)}>
        <AvatarWithRing
          avatarUrl={item.avatarUrl}
          displayName={item.displayName}
          size={44}
          isOnline={item.isOnline}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName ?? '—'}</Text>
          <Text style={styles.userEmail}>{item.email ?? ''}</Text>
        </View>
        {isSelected && <Feather name="check-circle" size={20} color={Colors.primary} />}
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item.id === next.item.id && prev.isSelected === next.isSelected,
);

export default function AdminNewChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('direct');

  // Shared user search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct chat state
  const [creating, setCreating] = useState(false);

  // Group state
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(text)}`);
        setResults(data);
      } catch {} finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    setQuery('');
    setResults([]);
    setSelected([]);
    setGroupName('');
    setLocalAvatarUri(null);
  }, []);

  const pickGroupAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  }, []);

  // ── Direct chat ───────────────────────────────────────────────────────────

  const startDirectChat = useCallback(async (user: UserResult) => {
    setCreating(true);
    try {
      const { data } = await api.post('/api/conversations', {
        type: 'direct',
        members: [user.id],
      });
      router.push(`/chat/${data.id}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start chat');
    } finally {
      setCreating(false);
    }
  }, [router]);

  const renderDirectItem = useCallback(({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => startDirectChat(item)}
      disabled={creating}
    >
      <AvatarWithRing avatarUrl={item.avatarUrl} displayName={item.displayName} size={44} isOnline={item.isOnline} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName ?? '—'}</Text>
        <Text style={styles.userEmail}>{item.email ?? ''}</Text>
      </View>
      {item.isOnline && <View style={styles.onlineDot} />}
    </TouchableOpacity>
  ), [startDirectChat, creating]);

  // ── Group chat ────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((user: UserResult) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  }, []);

  // Set gives O(1) lookup; recreated only when selected array changes.
  const selectedIds = useMemo(() => new Set(selected.map((u) => u.id)), [selected]);

  const renderGroupItem = useCallback(
    ({ item }: { item: UserResult }) => (
      <GroupUserRow
        item={item}
        isSelected={selectedIds.has(item.id)}
        onToggle={toggleSelect}
      />
    ),
    [selectedIds, toggleSelect],
  );

  const createGroup = useCallback(async () => {
    if (!groupName.trim()) { Alert.alert('Name required', 'Please enter a group name'); return; }
    if (selected.length < 1) { Alert.alert('Members required', 'Select at least one member'); return; }
    setCreating(true);
    try {
      // 1. Create the group conversation
      const { data } = await api.post('/api/conversations', {
        type: 'group',
        members: selected.map((u) => u.id),
        groupName: groupName.trim(),
      });
      if (!data?.id) throw new Error('Group created but no conversation ID was returned');

      // 2. Upload the avatar if one was selected (non-fatal — group still exists without it)
      if (localAvatarUri) {
        try {
          const formData = new FormData();
          formData.append('avatar', {
            uri: localAvatarUri,
            type: 'image/jpeg',
            name: 'group-avatar.jpg',
          } as unknown as Blob);
          await api.post(`/api/conversations/${data.id}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // Avatar upload failed — group still navigates normally; user can retry from profile
        }
      }

      // 3. Navigate to the new group chat
      router.push(`/chat/${data.id}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [groupName, selected, localAvatarUri, router]);

  // ── Broadcast ─────────────────────────────────────────────────────────────

  const sendBroadcast = useCallback(async () => {
    if (!broadcastMessage.trim()) {
      Alert.alert('Message required', 'Please type a message to broadcast');
      return;
    }
    Alert.alert(
      'Broadcast to all users?',
      'This will send a direct message to every user on the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: async () => {
            setBroadcasting(true);
            try {
              const { data } = await api.post('/api/admin/broadcast', {
                content: broadcastMessage.trim(),
              });
              setBroadcastMessage('');
              Alert.alert('Sent', `Broadcast delivered to ${data.sent} user${data.sent !== 1 ? 's' : ''}.`);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Broadcast failed');
            } finally {
              setBroadcasting(false);
            }
          },
        },
      ],
    );
  }, [broadcastMessage]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Chat</Text>
      </View>

      {/* Tab selector */}
      <View style={styles.tabs}>
        {(['direct', 'group', 'broadcast'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => switchTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'direct' ? 'Direct' : t === 'group' ? 'Group' : 'Broadcast'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Direct ── */}
      {tab === 'direct' && (
        <View style={styles.flex}>
          <GlassInput
            placeholder="Search by name or email..."
            leftIcon="search"
            value={query}
            onChangeText={handleQueryChange}
            containerStyle={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searching && <ActivityIndicator color={Colors.primary} style={styles.loader} />}
          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            renderItem={renderDirectItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews
            ListEmptyComponent={
              !searching ? (
                <Text style={styles.emptyText}>
                  {query ? 'No users found' : 'Search for someone to chat with'}
                </Text>
              ) : null
            }
          />
        </View>
      )}

      {/* ── Group ── */}
      {tab === 'group' && (
        <View style={styles.flex}>
          {/*
            Single-page group creation form.

            Layout order is intentional for Android keyboard stability:
            1. Group name input  — always rendered at top position (never shifts)
            2. Member search     — always rendered directly below name (never shifts)
            3. Selected chips    — conditional, appears BELOW the two inputs so
                                   neither input ever changes Y-position when chips appear
            4. Results FlatList  — fills remaining space
            5. Create button     — pinned at bottom, always visible so the intent is obvious

            Previously a 2-step wizard hid the group name until step 2, making the
            "Create Group" action invisible on step 1 and causing confusion.
          */}

          {/* ── Group avatar picker ──
              Tap to pick an image. Local URI is previewed immediately;
              actual upload happens after the group is created so we always
              have a valid conversation ID to associate the file with. */}
          <TouchableOpacity style={styles.avatarPicker} onPress={pickGroupAvatar}>
            {localAvatarUri ? (
              <Image source={{ uri: localAvatarUri }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="camera" size={22} color={Colors.textTertiary} />
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
            <View style={styles.avatarCameraBadge}>
              <Feather name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Group name — always visible so purpose is clear */}
          <GlassInput
            placeholder="Group name (required)"
            leftIcon="users"
            value={groupName}
            onChangeText={setGroupName}
            containerStyle={styles.search}
            returnKeyType="next"
            autoCapitalize="words"
          />

          {/* Member search — position never changes */}
          <GlassInput
            placeholder="Search members to add..."
            leftIcon="search"
            value={query}
            onChangeText={handleQueryChange}
            containerStyle={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {/* Selected chips — below both inputs so they never shift */}
          {selected.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectedList}
              keyboardShouldPersistTaps="handled"
            >
              {selected.map((u) => (
                <TouchableOpacity key={u.id} style={styles.selectedItem} onPress={() => toggleSelect(u)}>
                  <AvatarWithRing avatarUrl={u.avatarUrl} displayName={u.displayName} size={40} />
                  <View style={styles.checkmark}>
                    <Feather name="x" size={10} color="#fff" />
                  </View>
                  <Text style={styles.selectedName} numberOfLines={1}>{u.displayName ?? '—'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {searching && <ActivityIndicator color={Colors.primary} style={styles.loader} />}

          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            renderItem={renderGroupItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews
            ListEmptyComponent={
              !searching ? (
                <Text style={styles.emptyText}>
                  {query
                    ? 'No users found'
                    : selected.length === 0
                    ? 'Search for members to add to the group'
                    : ''}
                </Text>
              ) : null
            }
          />

          {/* Always-visible Create button — disabled when requirements unmet.
              paddingBottom = insets.bottom + tab-bar height so the button is never
              hidden behind the absolutely-positioned tab bar on Android/iOS. */}
          <View style={[styles.groupFooter, { paddingBottom: Math.max(insets.bottom + 56, 72) }]}>
            <NeonButton
              label={
                selected.length > 0
                  ? `Create Group · ${selected.length} member${selected.length !== 1 ? 's' : ''}`
                  : 'Create Group'
              }
              onPress={createGroup}
              loading={creating}
              fullWidth
            />
          </View>
        </View>
      )}

      {/* ── Broadcast ── */}
      {tab === 'broadcast' && (
        <ScrollView
          contentContainerStyle={styles.broadcastContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.broadcastIcon}>
            <Feather name="radio" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.broadcastTitle}>Broadcast Message</Text>
          <Text style={styles.broadcastSub}>
            Send a direct message to every user on the platform instantly.
          </Text>

          <View style={styles.broadcastInputWrapper}>
            <TextInput
              style={styles.broadcastInput}
              placeholder="Type your broadcast message..."
              placeholderTextColor={Colors.textTertiary}
              value={broadcastMessage}
              onChangeText={setBroadcastMessage}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{broadcastMessage.length}/500</Text>
          </View>

          <NeonButton
            label="Send to All Users"
            onPress={sendBroadcast}
            loading={broadcasting}
            fullWidth
            style={styles.broadcastBtn}
          />

          <View style={styles.broadcastNote}>
            <Feather name="info" size={14} color={Colors.textTertiary} />
            <Text style={styles.broadcastNoteText}>
              Each user will receive this as a personal direct message from you.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgLayer1,
    borderRadius: Radius.lg,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  activeTabText: { color: Colors.textPrimary },
  search: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  loader: { marginTop: 20 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  userInfo: { flex: 1 },
  userName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  userEmail: { color: Colors.textSecondary, fontSize: FontSize.xs },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  emptyText: { color: Colors.textTertiary, textAlign: 'center', marginTop: 40, fontSize: FontSize.sm },
  selectedList: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, maxHeight: 80 },
  selectedItem: { alignItems: 'center', marginRight: Spacing.md, width: 56 },
  selectedName: { color: Colors.textSecondary, fontSize: 10, marginTop: 4, maxWidth: 56, textAlign: 'center' },
  checkmark: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupFooter: { padding: Spacing.lg },
  // Group avatar picker
  avatarPicker: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bgLayer2,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bgLayer2,
    borderWidth: 2,
    borderColor: Colors.glassBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarPlaceholderText: { color: Colors.textTertiary, fontSize: 10 },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgBase,
  },
  // Broadcast
  broadcastContainer: {
    padding: Spacing.lg,
    paddingBottom: 60,
    alignItems: 'center',
    gap: Spacing.md,
  },
  broadcastIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  broadcastTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  broadcastSub: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  broadcastInputWrapper: {
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  broadcastInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    minHeight: 120,
  },
  charCount: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: 4,
  },
  broadcastBtn: { width: '100%', marginTop: Spacing.sm },
  broadcastNote: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
  },
  broadcastNoteText: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
});
