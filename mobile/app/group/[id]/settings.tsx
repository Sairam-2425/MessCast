import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AvatarWithRing } from '../../../components/ui/AvatarWithRing';
import { NeonButton } from '../../../components/ui/NeonButton';
import { GlassCard } from '../../../components/ui/GlassCard';
import { GlassInput } from '../../../components/ui/GlassInput';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  _id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

interface SearchUser {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
}

interface GroupConversation {
  id: string;
  groupName: string;
  groupAvatar: string | null;
  members: Member[];
  groupAdmins: string[];
  createdBy: string;
}

// ─── MemberRow (memoised) ─────────────────────────────────────────────────────
// Custom areEqual skips re-render unless identity, role, or permission flags change.

interface MemberRowProps {
  member: Member;
  isGroupAdmin: boolean;
  isCreator: boolean;
  isCurrentUser: boolean;
  canManageMembers: boolean;   // group admin || app admin
  canPromoteAdmins: boolean;   // creator || app admin
  onRemove: (id: string) => void;
  onMessage: (id: string) => void;
  onToggleAdmin: (id: string, makeAdmin: boolean) => void;
}

const MemberRow = memo(
  function MemberRow({
    member,
    isGroupAdmin,
    isCreator,
    isCurrentUser,
    canManageMembers,
    canPromoteAdmins,
    onRemove,
    onMessage,
    onToggleAdmin,
  }: MemberRowProps) {
    return (
      <View style={styles.memberRow}>
        <AvatarWithRing
          avatarUrl={member.avatarUrl}
          displayName={member.displayName}
          size={40}
          isOnline={member.isOnline}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.displayName}</Text>
          <View style={styles.badgeRow}>
            {isCreator && (
              <View style={[styles.roleBadge, styles.creatorBadge]}>
                <Text style={styles.creatorText}>Creator</Text>
              </View>
            )}
            {isGroupAdmin && !isCreator && (
              <View style={[styles.roleBadge, styles.adminBadge]}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.memberActions}>
          {/* Message — available for all users toward other members */}
          {!isCurrentUser && (
            <TouchableOpacity
              onPress={() => onMessage(member._id)}
              style={styles.actionIcon}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="message-circle" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Promote / demote — creator or app admin only, not toward creator */}
          {canPromoteAdmins && !isCurrentUser && !isCreator && (
            <TouchableOpacity
              onPress={() => onToggleAdmin(member._id, !isGroupAdmin)}
              style={styles.actionIcon}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="award"
                size={18}
                color={isGroupAdmin ? Colors.warning : Colors.textTertiary}
              />
            </TouchableOpacity>
          )}

          {/* Remove — group admin or app admin, not toward self */}
          {canManageMembers && !isCurrentUser && (
            <TouchableOpacity
              onPress={() => onRemove(member._id)}
              style={styles.actionIcon}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="user-minus" size={18} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.member._id === next.member._id &&
    prev.isGroupAdmin === next.isGroupAdmin &&
    prev.isCurrentUser === next.isCurrentUser &&
    prev.canManageMembers === next.canManageMembers &&
    prev.canPromoteAdmins === next.canPromoteAdmins,
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GroupProfileScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);

  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Add-members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the debounced search always reads the current member list without
  // needing to be in a useCallback dependency array (avoids re-creating the handler).
  const memberIdsRef = useRef<Set<string>>(new Set());

  // ── Permission flags ───────────────────────────────────────────────────────
  const isAppAdmin = currentUser?.role === 'admin';
  const isGroupAdmin = group?.groupAdmins.includes(currentUser?.id ?? '') ?? false;
  const isCreator = group?.createdBy === currentUser?.id;
  const canManageMembers = isGroupAdmin || isAppAdmin;
  const canPromoteAdmins = isCreator || isAppAdmin;
  const canEditGroup = isGroupAdmin || isAppAdmin;

  // ── Load group ─────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/api/conversations/${conversationId}`)
      .then(({ data }) => {
        setGroup(data);
        setEditName(data.groupName ?? '');
        memberIdsRef.current = new Set(data.members.map((m: Member) => m._id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  // Keep memberIdsRef in sync whenever group.members changes (e.g., after adding a member)
  useEffect(() => {
    memberIdsRef.current = new Set(group?.members.map((m) => m._id) ?? []);
  }, [group?.members]);

  // ── Add-members search ─────────────────────────────────────────────────────
  const handleAddQueryChange = useCallback((text: string) => {
    setAddQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setAddResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(text)}`);
        // Filter out members already in the group (use ref to avoid stale closure)
        setAddResults((data as SearchUser[]).filter((u) => !memberIdsRef.current.has(u.id)));
      } catch {} finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const addMember = useCallback(async (userId: string) => {
    setAddingMember(true);
    try {
      await api.post(`/api/conversations/${conversationId}/members`, { userId });
      // Re-fetch to get the freshly populated member list
      const { data } = await api.get(`/api/conversations/${conversationId}`);
      setGroup(data);
      setAddResults((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }, [conversationId]);

  // ── Member actions ─────────────────────────────────────────────────────────
  const removeMember = useCallback((memberId: string) => {
    Alert.alert('Remove member', 'Remove this member from the group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/conversations/${conversationId}/members/${memberId}`);
            setGroup((g) => g ? { ...g, members: g.members.filter((m) => m._id !== memberId) } : g);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }, [conversationId]);

  const messageMember = useCallback(async (memberId: string) => {
    try {
      const { data } = await api.post('/api/conversations', {
        type: 'direct',
        members: [memberId],
      });
      router.push(`/chat/${data.id}`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open chat');
    }
  }, [router]);

  const toggleAdmin = useCallback((memberId: string, makeAdmin: boolean) => {
    const label = makeAdmin ? 'Make Group Admin' : 'Remove Admin Role';
    Alert.alert(label, 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await api.patch(`/api/conversations/${conversationId}/admins`, {
              userId: memberId,
              action: makeAdmin ? 'promote' : 'demote',
            });
            const { data } = await api.get(`/api/conversations/${conversationId}`);
            setGroup(data);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }, [conversationId]);

  // ── Group actions ──────────────────────────────────────────────────────────
  const changeGroupAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'group-avatar.jpg',
      } as unknown as Blob);
      const { data } = await api.post(
        `/api/conversations/${conversationId}/avatar`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setGroup((g) => (g ? { ...g, groupAvatar: data.groupAvatar } : g));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update group photo');
    } finally {
      setUploadingAvatar(false);
    }
  }, [conversationId]);

  async function saveGroupName() {
    if (!editName.trim() || !group) return;
    setSaving(true);
    try {
      await api.patch(`/api/conversations/${conversationId}/group`, { groupName: editName.trim() });
      setGroup((g) => g ? { ...g, groupName: editName.trim() } : g);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function leaveGroup() {
    Alert.alert('Leave Group', 'Leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/conversations/${conversationId}/members/${currentUser?.id}`);
            router.replace(isAppAdmin ? '/(admin)' : '/(user)');
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }

  async function deleteGroup() {
    Alert.alert('Delete Group', 'This will permanently delete the group and all messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/admin/conversations/${conversationId}`);
            router.replace(isAppAdmin ? '/(admin)' : '/(user)');
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
          }
        },
      },
    ]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (!group) return null;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Profile</Text>
      </View>

      {/* ── Profile hero ──
          Avatar is tappable for group admins and app admins.
          A camera badge and loading overlay indicate the edit affordance. */}
      <View style={styles.profileSection}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={canEditGroup ? changeGroupAvatar : undefined}
          disabled={uploadingAvatar}
          activeOpacity={canEditGroup ? 0.7 : 1}
        >
          <AvatarWithRing
            avatarUrl={group.groupAvatar}
            displayName={group.groupName}
            size={90}
          />
          {canEditGroup && (
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={14} color="#fff" />
              )}
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.groupName}>{group.groupName}</Text>
        <Text style={styles.memberCount}>
          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Edit group info (group admins + app admins) ── */}
      {canEditGroup && (
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>EDIT GROUP</Text>
          <GlassInput
            value={editName}
            onChangeText={setEditName}
            placeholder="Group name..."
            leftIcon="edit-2"
            returnKeyType="done"
          />
          <NeonButton
            label="Save Name"
            onPress={saveGroupName}
            loading={saving}
            style={styles.saveBtn}
          />
        </GlassCard>
      )}

      {/* ── Members ── */}
      <GlassCard style={styles.card}>
        {/* Section header + Add Members toggle */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            MEMBERS ({group.members.length})
          </Text>
          {canManageMembers && (
            <TouchableOpacity
              style={styles.addMembersBtn}
              onPress={() => {
                setShowAddMembers((v) => !v);
                setAddQuery('');
                setAddResults([]);
              }}
            >
              <Feather
                name={showAddMembers ? 'x' : 'user-plus'}
                size={15}
                color={Colors.primary}
              />
              <Text style={styles.addMembersBtnText}>
                {showAddMembers ? 'Cancel' : 'Add Members'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Add Members search (only when expanded) ──
            The search input is always the first element in this section so its
            Y-position never changes when results appear below it — preventing
            Android keyboard dismissal from layout shifts. */}
        {showAddMembers && (
          <View style={styles.addMembersSection}>
            <GlassInput
              placeholder="Search users to add..."
              leftIcon="search"
              value={addQuery}
              onChangeText={handleAddQueryChange}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searching && (
              <ActivityIndicator
                color={Colors.primary}
                style={{ marginVertical: Spacing.sm }}
              />
            )}
            {addResults.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.searchRow}
                onPress={() => addMember(u.id)}
                disabled={addingMember}
              >
                <AvatarWithRing
                  avatarUrl={u.avatarUrl}
                  displayName={u.displayName}
                  size={36}
                  isOnline={u.isOnline}
                />
                <Text style={styles.searchName}>{u.displayName ?? '—'}</Text>
                <Feather name="plus-circle" size={20} color={Colors.primary} />
              </TouchableOpacity>
            ))}
            {!searching && addQuery.trim() !== '' && addResults.length === 0 && (
              <Text style={styles.emptySearch}>No users found</Text>
            )}
          </View>
        )}

        {/* ── Member list ── */}
        {group.members.map((m) => (
          <MemberRow
            key={m._id}
            member={m}
            isGroupAdmin={group.groupAdmins.includes(m._id)}
            isCreator={group.createdBy === m._id}
            isCurrentUser={m._id === currentUser?.id}
            canManageMembers={canManageMembers}
            canPromoteAdmins={canPromoteAdmins}
            onRemove={removeMember}
            onMessage={messageMember}
            onToggleAdmin={toggleAdmin}
          />
        ))}
      </GlassCard>

      {/* ── Danger zone ── */}
      <GlassCard style={[styles.card, styles.dangerCard]}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <NeonButton label="Leave Group" variant="danger" onPress={leaveGroup} fullWidth />
        {(isCreator || isAppAdmin) && (
          <NeonButton
            label="Delete Group"
            variant="danger"
            onPress={deleteGroup}
            fullWidth
            style={{ marginTop: Spacing.sm }}
          />
        )}
      </GlassCard>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },

  profileSection: { alignItems: 'center', gap: 8, paddingVertical: Spacing.lg },
  avatarWrapper: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgBase,
  },
  groupName: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  memberCount: { color: Colors.textSecondary, fontSize: FontSize.sm },

  card: { padding: Spacing.lg, gap: Spacing.md },
  dangerCard: { borderColor: 'rgba(255,77,106,0.3)' },

  sectionTitle: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  saveBtn: { alignSelf: 'flex-start' },

  // Add members
  addMembersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,92,252,0.12)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addMembersBtnText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  addMembersSection: { gap: Spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  searchName: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  emptySearch: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },

  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  memberInfo: { flex: 1 },
  memberName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  adminBadge: { borderColor: Colors.primary, backgroundColor: 'rgba(124,92,252,0.12)' },
  adminText: { color: Colors.primary, fontSize: 9, fontWeight: FontWeight.semibold },
  creatorBadge: { borderColor: Colors.warning, backgroundColor: 'rgba(255,181,64,0.12)' },
  creatorText: { color: Colors.warning, fontSize: 9, fontWeight: FontWeight.semibold },

  memberActions: { flexDirection: 'row', gap: Spacing.sm },
  actionIcon: { padding: 4 },
});
