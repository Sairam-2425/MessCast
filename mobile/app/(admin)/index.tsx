import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ChatListItem } from '../../components/chat/ChatListItem';
import { AdminActionSheet, AdminAction } from '../../components/admin/AdminActionSheet';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { useChatStore, Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';

export default function AdminChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { conversations, setConversations, pinnedIds, archivedIds, resetUnread } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSheet, setActionSheet] = useState<{ visible: boolean; conv: Conversation | null }>({
    visible: false,
    conv: null,
  });
  const searchInputRef = useRef<TextInput>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/api/conversations');
      setConversations(data);
    } catch {}
  }, [setConversations]);

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const handlePin = useCallback(async (conv: Conversation) => {
    try {
      await api.post(`/api/conversations/${conv.id}/pin`);
      useChatStore.getState().togglePin(conv.id);
    } catch {}
  }, []);

  const handleArchive = useCallback(async (conv: Conversation) => {
    try {
      await api.post(`/api/conversations/${conv.id}/archive`);
      useChatStore.getState().toggleArchive(conv.id);
      fetchConversations();
    } catch {}
  }, [fetchConversations]);

  const openActionSheet = useCallback((conv: Conversation) => {
    setActionSheet({ visible: true, conv });
  }, []);

  const getActions = useCallback((conv: Conversation): AdminAction[] => [
    {
      label: pinnedIds.has(conv.id) ? '📌 Unpin' : '📌 Pin',
      onPress: () => handlePin(conv),
    },
    {
      label: '🗂 Archive',
      onPress: () => handleArchive(conv),
    },
  ], [pinnedIds, handlePin, handleArchive]);

  const openSearch = useCallback(() => {
    setShowSearch(true);
    // TextInput autoFocus handles focusing
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
  }, []);

  // Client-side filter by name/group name
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        if (c.type === 'group') return (c.groupName ?? '').toLowerCase().includes(q);
        const other = c.members.find((m) => m._id !== user?.id);
        return (other?.displayName ?? '').toLowerCase().includes(q);
      })
    : conversations;

  // Pinned first, then newest
  const sorted = [...filtered].sort((a, b) => {
    const ap = pinnedIds.has(a.id) ? 1 : 0;
    const bp = pinnedIds.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const pinned = sorted.filter((c) => pinnedIds.has(c.id));
  const notArchived = sorted.filter((c) => !archivedIds.has(c.id));

  const keyExtractor = useCallback((c: Conversation) => c.id, []);

  const renderPinnedItem = useCallback(({ item }: { item: Conversation }) => {
    const isDirect = item.type === 'direct';
    const other = item.members.find((m) => m._id !== user?.id);
    const name = isDirect ? (other?.displayName ?? 'Unknown') : (item.groupName ?? 'Group');
    const avatar = isDirect ? (other?.avatarUrl ?? null) : (item.groupAvatar ?? null);
    return (
      <TouchableOpacity
        style={styles.pinnedItem}
        onPress={() => {
          resetUnread(item.id);
          router.push(`/chat/${item.id}`);
        }}
      >
        <AvatarWithRing
          avatarUrl={avatar}
          displayName={name}
          size={52}
          isOnline={isDirect ? (other?.isOnline ?? false) : false}
        />
        <Text style={styles.pinnedName} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>
    );
  }, [user, resetUnread, router]);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ChatListItem
      conversation={item}
      currentUserId={user?.id ?? ''}
      isPinned={pinnedIds.has(item.id)}
      onPress={() => {
        resetUnread(item.id);
        router.push(`/chat/${item.id}`);
      }}
      onLongPress={() => openActionSheet(item)}
    />
  ), [user, pinnedIds, resetUnread, router, openActionSheet]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BlurView intensity={80} tint="dark" style={styles.header}>
        {showSearch ? (
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            <TouchableOpacity onPress={closeSearch} style={styles.searchClose}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>MESSCAST</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn} onPress={openSearch}>
                <Feather name="search" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => router.push('/(admin)/new-chat')}
              >
                <Feather name="edit" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </BlurView>

      {/* Pinned horizontal strip */}
      {pinned.length > 0 && !showSearch && (
        <View style={styles.pinnedSection}>
          <Text style={styles.pinnedLabel}>PINNED</Text>
          <FlatList
            horizontal
            data={pinned}
            keyExtractor={keyExtractor}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pinnedList}
            keyboardShouldPersistTaps="handled"
            renderItem={renderPinnedItem}
          />
        </View>
      )}

      {/* Conversation list */}
      <FlatList
        data={notArchived}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching chats' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try a different search term' : 'Tap the edit icon to start a chat'}
            </Text>
          </View>
        }
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    minHeight: 56,
  },
  headerTitle: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 3,
    textShadowColor: Colors.primaryGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.sm,
    height: 40,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingVertical: 0,
  },
  searchClose: { padding: 4 },
  pinnedSection: { paddingTop: Spacing.md },
  pinnedLabel: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  pinnedList: { paddingHorizontal: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.md },
  pinnedItem: { alignItems: 'center', gap: 6, width: 64 },
  pinnedName: { color: Colors.textSecondary, fontSize: FontSize.xs, maxWidth: 64, textAlign: 'center' },
  list: { paddingBottom: 100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.md },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  emptyText: { color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center' },
});
