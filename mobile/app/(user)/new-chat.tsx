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

export default function NewChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const switchTab = useCallback((t: 'direct' | 'group') => {
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

  const startDirectChat = useCallback(async (user: UserResult) => {
    setCreating(true);
    try {
      const { data } = await api.post('/api/conversations', {
        type: 'direct',
        members: [user.id],
      });
      router.push(`/chat/${data.id}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }, [router]);

  const toggleSelect = useCallback((user: UserResult) => {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  }, []);

  const createGroup = useCallback(async () => {
    if (!groupName.trim()) { Alert.alert('Name required', 'Please enter a group name'); return; }
    if (selected.length < 1) { Alert.alert('Members required', 'Select at least one member to create a group'); return; }
    setCreating(true);
    try {
      // 1. Create the group conversation
      const { data } = await api.post('/api/conversations', {
        type: 'group',
        members: selected.map((u) => u.id),
        groupName: groupName.trim(),
      });
      if (!data?.id) throw new Error('Group created but no conversation ID was returned');

      // 2. Upload avatar if selected (non-fatal — group navigates normally without it)
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
          // Avatar upload failed — group is still created; user can retry from group profile
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

  const renderDirectItem = useCallback(({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => startDirectChat(item)}
      disabled={creating}
    >
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
      {item.isOnline && <View style={styles.onlineIndicator} />}
    </TouchableOpacity>
  ), [startDirectChat, creating]);

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

  const keyExtractor = useCallback((u: UserResult) => u.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>New Chat</Text>
      </View>

      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'direct' && styles.activeTab]}
          onPress={() => switchTab('direct')}
        >
          <Text style={[styles.tabText, tab === 'direct' && styles.activeTabText]}>Direct</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'group' && styles.activeTab]}
          onPress={() => switchTab('group')}
        >
          <Text style={[styles.tabText, tab === 'group' && styles.activeTabText]}>New Group</Text>
        </TouchableOpacity>
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
          {searching && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
          <FlatList
            data={results}
            keyExtractor={keyExtractor}
            renderItem={renderDirectItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews
            maxToRenderPerBatch={10}
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
          {/* ── Group avatar picker ──
              Local URI is previewed immediately; actual upload happens after the
              group is created so we always have a valid conversation ID. */}
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

          {/* Group name — always visible so creation intent is immediately clear */}
          <GlassInput
            placeholder="Group name (required)"
            leftIcon="users"
            value={groupName}
            onChangeText={setGroupName}
            containerStyle={styles.search}
            returnKeyType="next"
            autoCapitalize="words"
          />

          {/* Member search — always below group name, never shifts position */}
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

          {/* Chips — conditional but below both inputs so they never shift */}
          {selected.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectedList}
              keyboardShouldPersistTaps="handled"
            >
              {selected.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.selectedItem}
                  onPress={() => toggleSelect(u)}
                >
                  <AvatarWithRing avatarUrl={u.avatarUrl} displayName={u.displayName} size={40} />
                  <View style={styles.checkmark}>
                    <Feather name="x" size={10} color="#fff" />
                  </View>
                  <Text style={styles.selectedName} numberOfLines={1}>
                    {u.displayName ?? '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {searching && <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />}

          <FlatList
            data={results}
            keyExtractor={keyExtractor}
            renderItem={renderGroupItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            removeClippedSubviews
            maxToRenderPerBatch={10}
            ListEmptyComponent={
              !searching ? (
                <Text style={styles.emptyText}>
                  {query
                    ? 'No users found'
                    : selected.length === 0
                    ? 'Search for members to add'
                    : ''}
                </Text>
              ) : null
            }
          />

          {/* Always-visible Create button — disabled until name + members provided.
              paddingBottom accounts for the absolute tab bar so the button is visible. */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
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
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  emptyText: {
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: FontSize.sm,
  },
  selectedList: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, maxHeight: 80 },
  selectedItem: { alignItems: 'center', marginRight: Spacing.md, width: 56 },
  selectedName: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    maxWidth: 56,
    textAlign: 'center',
  },
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
});
