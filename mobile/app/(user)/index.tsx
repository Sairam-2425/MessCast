import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CONTENT_HEIGHT } from './_layout';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ChatListItem } from '../../components/chat/ChatListItem';
import { AdminActionSheet, AdminAction } from '../../components/admin/AdminActionSheet';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { useChatStore, Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'all' | 'unread' | 'groups' | 'archived';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'groups',   label: 'Groups' },
  { key: 'archived', label: 'Archived' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user   = useAuthStore((s) => s.user);

  const {
    conversations,
    archivedConversations,
    setConversations,
    setArchivedConversations,
    pinnedIds,
    archivedIds,
    resetUnread,
  } = useChatStore();

  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>('all');
  const [showSearch, setShowSearch]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [actionSheet, setActionSheet]     = useState<{
    visible: boolean; conv: Conversation | null;
  }>({ visible: false, conv: null });

  const searchRef = useRef<TextInput>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/api/conversations');
      setConversations(data);
    } catch {}
  }, [setConversations]);

  const fetchArchivedConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/api/conversations/archived');
      setArchivedConversations(data);
      setArchivedLoaded(true);
    } catch {}
  }, [setArchivedConversations]);

  // Initial load
  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  // Load archived when that tab is first opened
  useEffect(() => {
    if (activeTab === 'archived' && !archivedLoaded) {
      fetchArchivedConversations();
    }
  }, [activeTab, archivedLoaded, fetchArchivedConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    if (activeTab === 'archived') await fetchArchivedConversations();
    setRefreshing(false);
  }, [fetchConversations, fetchArchivedConversations, activeTab]);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Sort non-archived conversations: pinned first, then by updatedAt
  const sortedActive = useMemo(() => {
    const base = conversations.filter((c) => !archivedIds.has(c.id));
    return [...base].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 1 : 0;
      const bp = pinnedIds.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [conversations, archivedIds, pinnedIds]);

  const pinned = useMemo(
    () => sortedActive.filter((c) => pinnedIds.has(c.id)),
    [sortedActive, pinnedIds],
  );

  // Number of conversations with unread messages (for the Unread chip badge)
  const unreadConvCount = useMemo(
    () => sortedActive.filter((c) => c.unreadCount > 0).length,
    [sortedActive],
  );

  // Total unread message count (header badge)
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    [conversations],
  );

  // Apply search + tab filter
  const listData = useMemo(() => {
    const pool = activeTab === 'archived' ? archivedConversations : sortedActive;

    // Search within the current tab
    const q = searchQuery.trim().toLowerCase();
    const searched = q
      ? pool.filter((c) => {
          const other = c.members.find((m) => m._id !== user?.id);
          const name  = c.type === 'group'
            ? (c.groupName ?? '').toLowerCase()
            : (other?.displayName ?? '').toLowerCase();
          const preview = (c.lastMessage?.content ?? '').toLowerCase();
          return name.includes(q) || preview.includes(q);
        })
      : pool;

    switch (activeTab) {
      case 'unread':
        return searched.filter((c) => c.unreadCount > 0);
      case 'groups':
        return searched.filter((c) => c.type === 'group');
      default:
        return searched;
    }
  }, [activeTab, sortedActive, archivedConversations, searchQuery, user?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function openActionSheet(conv: Conversation) {
    setActionSheet({ visible: true, conv });
  }

  async function handlePin(conv: Conversation) {
    try {
      await api.post(`/api/conversations/${conv.id}/pin`);
      useChatStore.getState().togglePin(conv.id);
    } catch {}
  }

  async function handleArchive(conv: Conversation) {
    try {
      await api.post(`/api/conversations/${conv.id}/archive`);
      useChatStore.getState().toggleArchive(conv.id);
      resetUnread(conv.id);
      fetchConversations();
    } catch {}
  }

  async function handleUnarchive(conv: Conversation) {
    try {
      await api.post(`/api/conversations/${conv.id}/archive`); // same toggle endpoint
      useChatStore.getState().toggleArchive(conv.id);
      await fetchConversations();
      await fetchArchivedConversations();
    } catch {}
  }

  function handleDeleteChat(conv: Conversation) {
    Alert.alert(
      'Delete conversation?',
      'This will remove the conversation from your list. Messages are preserved for other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/conversations/${conv.id}`);
              fetchConversations();
              if (activeTab === 'archived') fetchArchivedConversations();
            } catch {}
          },
        },
      ],
    );
  }

  // Action sheet contents differ between the Archived tab and other tabs
  const getActions = (conv: Conversation): AdminAction[] => {
    if (activeTab === 'archived') {
      return [
        { label: '🗂 Unarchive', onPress: () => handleUnarchive(conv) },
        { label: '🗑 Delete Chat', onPress: () => handleDeleteChat(conv) },
      ];
    }
    return [
      {
        label: pinnedIds.has(conv.id) ? '📌 Unpin' : '📌 Pin',
        onPress: () => handlePin(conv),
      },
      { label: '🗂 Archive', onPress: () => handleArchive(conv) },
      { label: '🗑 Delete Chat', onPress: () => handleDeleteChat(conv) },
    ];
  };

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setSearchQuery('');
  }

  // ── Empty state labels per tab ─────────────────────────────────────────────

  const emptyTitle = useMemo(() => {
    if (searchQuery) return 'No results found';
    switch (activeTab) {
      case 'unread':   return 'All caught up!';
      case 'groups':   return 'No group chats';
      case 'archived': return 'No archived chats';
      default:         return 'No conversations yet';
    }
  }, [activeTab, searchQuery]);

  const emptySubtitle = useMemo(() => {
    if (searchQuery) return 'Try a different search term';
    switch (activeTab) {
      case 'unread':   return 'You have no unread messages';
      case 'groups':   return 'Create a group to chat with multiple people';
      case 'archived': return 'Long press a chat and select Archive';
      default:         return 'Tap the compose icon above to start chatting';
    }
  }, [activeTab, searchQuery]);

  const keyExtractor = useCallback((c: Conversation) => c.id, []);

  // ── Loading spinner ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      {/* ── Header ── */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        {showSearch ? (
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={Colors.textSecondary} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search conversations…"
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={() => { setShowSearch(false); setSearchQuery(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>MESSCAST</Text>
              {totalUnread > 0 && (
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
                <Feather name="search" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnPrimary]}
                onPress={() => router.push('/(user)/new-chat')}
              >
                <Feather name="edit-2" size={17} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </BlurView>

      {/* ── Filter chips (WhatsApp-style) ── */}
      {!showSearch && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge    = tab.key === 'unread' ? unreadConvCount : 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {tab.label}
                </Text>
                {badge > 0 && (
                  <View style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                    <Text style={styles.chipBadgeText}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Pinned contacts strip — only on All tab ── */}
      {pinned.length > 0 && activeTab === 'all' && !showSearch && (
        <View style={styles.pinnedSection}>
          <Text style={styles.pinnedLabel}>PINNED</Text>
          <FlatList
            horizontal
            data={pinned}
            keyExtractor={keyExtractor}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pinnedList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isDirect  = item.type === 'direct';
              const other     = item.members.find((m) => m._id !== user?.id);
              const name      = isDirect ? (other?.displayName ?? 'Unknown') : (item.groupName ?? 'Group');
              const avatar    = isDirect ? (other?.avatarUrl ?? null) : (item.groupAvatar ?? null);
              const hasUnread = item.unreadCount > 0;
              return (
                <TouchableOpacity
                  style={styles.pinnedItem}
                  onPress={() => { resetUnread(item.id); router.push(`/chat/${item.id}`); }}
                  activeOpacity={0.7}
                >
                  <View>
                    <AvatarWithRing
                      avatarUrl={avatar}
                      displayName={name}
                      size={52}
                      isOnline={isDirect ? (other?.isOnline ?? false) : false}
                      showRing={hasUnread}
                    />
                    {hasUnread && (
                      <View style={styles.pinnedBadge}>
                        <Text style={styles.pinnedBadgeText}>
                          {item.unreadCount > 9 ? '9+' : item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.pinnedName} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── Conversation list ── */}
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 12 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather
                name={
                  activeTab === 'groups'   ? 'users' :
                  activeTab === 'archived' ? 'archive' :
                  activeTab === 'unread'   ? 'check-circle' :
                  'message-circle'
                }
                size={36}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatListItem
            conversation={item}
            currentUserId={user?.id ?? ''}
            isPinned={pinnedIds.has(item.id)}
            onPress={() => { resetUnread(item.id); router.push(`/chat/${item.id}`); }}
            onLongPress={() => openActionSheet(item)}
            // Swipe-left to archive/unarchive
            onArchive={
              activeTab === 'archived'
                ? () => handleUnarchive(item)
                : () => handleArchive(item)
            }
          />
        )}
      />

      {/* ── Action sheet ── */}
      {actionSheet.conv && (
        <AdminActionSheet
          visible={actionSheet.visible}
          title={
            actionSheet.conv.groupName ??
            actionSheet.conv.members.find((m) => m._id !== user?.id)?.displayName
          }
          actions={getActions(actionSheet.conv)}
          onClose={() => setActionSheet({ visible: false, conv: null })}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgBase },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
    minHeight: 56,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 3,
    textShadowColor: Colors.primaryGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  totalBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  totalBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.bold,
    lineHeight: 13,
  },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: {
    backgroundColor: 'rgba(124,92,252,0.15)',
    borderColor: 'rgba(124,92,252,0.35)',
    ...Shadow.neonPrimary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Search bar (replaces header when active)
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingVertical: 0,
  },

  // ── Filter chips ───────────────────────────────────────────────────────────
  filterBar: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
  },
  filterBarContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLayer2,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  chipActive: {
    backgroundColor: 'rgba(124,92,252,0.18)',
    borderColor: Colors.primary,
    ...Shadow.neonPrimary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  chipBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chipBadgeActive: {
    backgroundColor: Colors.primary,
  },
  chipBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: FontWeight.bold,
    lineHeight: 12,
  },

  // ── Pinned strip ───────────────────────────────────────────────────────────
  pinnedSection: { paddingTop: Spacing.md },
  pinnedLabel: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  pinnedList: { paddingHorizontal: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.sm },
  pinnedItem: { alignItems: 'center', gap: 5, width: 64 },
  pinnedName: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    maxWidth: 64,
    textAlign: 'center',
  },
  pinnedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: Radius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bgBase,
  },
  pinnedBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold, lineHeight: 12 },

  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {},

  // ── Empty state ───────────────────────────────────────────────────────────
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(124,92,252,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadow.neonPrimary,
    shadowOpacity: 0.2,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
