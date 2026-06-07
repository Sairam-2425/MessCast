import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  BackHandler,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { format, isToday, isYesterday } from 'date-fns';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { InputBar } from '../../components/chat/InputBar';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { PinnedBanner } from '../../components/chat/PinnedBanner';
import { AvatarWithRing } from '../../components/ui/AvatarWithRing';
import { MessageContextMenu, ContextAction } from '../../components/chat/MessageContextMenu';
import { ForwardPicker } from '../../components/chat/ForwardPicker';
import { FullscreenImageViewer } from '../../components/ui/FullscreenImageViewer';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { useMessageStore, Message } from '../../store/messageStore';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../lib/socket';
import api from '../../lib/axios';
import { MESSAGE_PAGE_SIZE } from '../../constants/config';

const HEADER_HEIGHT = 56;

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d, yyyy');
  return (
    <View style={sepStyles.row}>
      <View style={sepStyles.line} />
      <Text style={sepStyles.text}>{label}</Text>
      <View style={sepStyles.line} />
    </View>
  );
}
const sepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.glassBorder },
  text: { color: Colors.textTertiary, fontSize: FontSize.xs, marginHorizontal: Spacing.sm },
});

// ─── Highlighted text (search results) ────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <Text style={searchStyles.resultText}>{text}</Text>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <Text style={searchStyles.resultText}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={searchStyles.highlight}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

const searchStyles = StyleSheet.create({
  resultText: { color: Colors.textPrimary, fontSize: FontSize.sm },
  highlight:  { backgroundColor: 'rgba(124,92,252,0.35)', color: Colors.textPrimary, borderRadius: 2 },
});

// ─── FlatList data types ───────────────────────────────────────────────────────

type FlatListItem = Message | { type: 'separator'; date: string; id: string };

function buildFlatData(messages: Message[]): FlatListItem[] {
  const result: FlatListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    if (!isNaN(d.getTime())) {
      const day = format(d, 'yyyy-MM-dd');
      if (day !== lastDate) {
        lastDate = day;
        result.push({ type: 'separator', date: msg.createdAt, id: `sep_${day}` });
      }
    }
    result.push(msg);
  }
  return result;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatRoom() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const conversationId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const {
    setMessages, addMessage, prependMessages,
    setReplyingTo, replyingTo,
    updateMessage, deleteMessage,
    setTyping, clearTyping,
  } = useMessageStore();
  const messages     = useMessageStore((s) => s.messagesByConversation[conversationId] ?? []);
  const typingUsers  = useMessageStore((s) => s.typingUsers[conversationId] ?? []);
  const replying     = replyingTo[conversationId] ?? null;
  const { conversations, resetUnread, updateMemberOnlineStatus } = useChatStore();

  const flatRef = useRef<FlatList>(null);

  // ── Load state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);

  // ── Image viewer ─────────────────────────────────────────────────────────────
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // ── Forward picker ───────────────────────────────────────────────────────────
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  // ── Context menu ─────────────────────────────────────────────────────────────
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);

  // ── Edit mode ────────────────────────────────────────────────────────────────
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);

  // ── Search mode ──────────────────────────────────────────────────────────────
  const [searchMode, setSearchMode]           = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [serverResults, setServerResults]     = useState<Message[]>([]);
  const [serverSearching, setServerSearching] = useState(false);
  const searchRef      = useRef<TextInput>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoised to avoid spurious re-triggers of the server-search effect
  const localResults = useMemo(
    () =>
      searchQuery.trim().length >= 1
        ? messages.filter(
            (m) => m.type === 'text' && m.content?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : [],
    [searchQuery, messages],
  );

  const searchResults = localResults.length > 0 ? localResults : serverResults;

  // Server-side search fallback — only fires when local yields nothing
  useEffect(() => {
    if (!searchMode) {
      setServerResults([]);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 2 || localResults.length > 0) {
      setServerResults([]);
      return;
    }

    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setServerSearching(true);
      try {
        const { data } = await api.get(
          `/api/messages/${conversationId}/search?q=${encodeURIComponent(q)}`
        );
        setServerResults(data);
      } catch {
        setServerResults([]);
      } finally {
        setServerSearching(false);
      }
    }, 500);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery, searchMode, localResults.length, conversationId]);

  // ── Conversation info ────────────────────────────────────────────────────────
  const conversation  = conversations.find((c) => c.id === conversationId);
  const isGroup       = conversation?.type === 'group';
  const otherMember   = !isGroup ? conversation?.members.find((m) => m._id !== user?.id) : null;
  const displayName   = isGroup ? (conversation?.groupName ?? 'Group') : (otherMember?.displayName ?? '…');
  const avatarUrl     = isGroup ? (conversation?.groupAvatar ?? null) : (otherMember?.avatarUrl ?? null);
  const isOnline      = !isGroup && (otherMember?.isOnline ?? false);
  const memberCount   = conversation?.members.length ?? 2;

  // ── Android back: close search/menu first ────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuMsg) { setMenuMsg(null); return true; }
      if (searchMode) {
        setSearchMode(false);
        setSearchQuery('');
        setServerResults([]);
        return true;
      }
      if (editingMsg) { setEditingMsg(null); return true; }
      return false;
    });
    return () => handler.remove();
  }, [menuMsg, searchMode, editingMsg]);

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.emit('join_conversation', conversationId);
    resetUnread(conversationId);
    // Mark all existing unread messages as read in DB so they don't reappear as unread on next open
    api.post('/api/messages/bulk-read', { conversationId }).catch(() => {});
    fetchMessages(1).finally(() => setLoading(false));
    fetchPinnedMessage();

    function onNewMessage(msg: Message) {
      addMessage(conversationId, msg);
      if (msg.sender._id !== user?.id) {
        api.patch(`/api/messages/${msg._id}/read`).catch(() => {});
        api.patch(`/api/messages/${msg._id}/delivered`).catch(() => {});
      }
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }

    function onMessageEdited(msg: Message) {
      updateMessage(conversationId, msg._id, msg);
    }

    function onMessageDeleted({
      messageId,
      deletedForAll: forAll,
    }: {
      messageId: string;
      conversationId: string;
      deletedForAll: boolean;
    }) {
      if (forAll) {
        updateMessage(conversationId, messageId, {
          deletedForAll: true,
          content: null,
          fileUrl: null,
        });
      } else {
        deleteMessage(conversationId, messageId);
      }
    }

    function onReactionUpdated({ messageId, reactions }: { messageId: string; reactions: Message['reactions'] }) {
      updateMessage(conversationId, messageId, { reactions });
    }

    function onMessageRead({ messageId, userId }: { messageId: string; userId: string }) {
      const current = useMessageStore.getState().messagesByConversation[conversationId] ?? [];
      const msg = current.find((m) => m._id === messageId);
      if (msg && !msg.readBy.includes(userId)) {
        updateMessage(conversationId, messageId, { readBy: [...msg.readBy, userId] });
      }
    }

    function onMessageDelivered({ messageId, userId }: { messageId: string; userId: string }) {
      const current = useMessageStore.getState().messagesByConversation[conversationId] ?? [];
      const msg = current.find((m) => m._id === messageId);
      if (msg && !msg.deliveredTo.includes(userId)) {
        updateMessage(conversationId, messageId, { deliveredTo: [...msg.deliveredTo, userId] });
      }
    }

    function onTyping({ user: tu }: { conversationId: string; user: { id: string; displayName: string } }) {
      setTyping(conversationId, tu);
    }

    function onStopTyping({ userId }: { conversationId: string; userId: string }) {
      clearTyping(conversationId, userId);
    }

    function onUserOnline({ userId }: { userId: string }) {
      updateMemberOnlineStatus(userId, true);
    }

    function onUserOffline({ userId, lastSeen }: { userId: string; lastSeen?: string }) {
      updateMemberOnlineStatus(userId, false, lastSeen);
    }

    socket.on('new_message',       onNewMessage);
    socket.on('message_edited',    onMessageEdited);
    socket.on('message_deleted',   onMessageDeleted);
    socket.on('reaction_updated',  onReactionUpdated);
    socket.on('message_read',      onMessageRead);
    socket.on('message_delivered', onMessageDelivered);
    socket.on('typing',            onTyping);
    socket.on('stop_typing',       onStopTyping);
    socket.on('user_online',       onUserOnline);
    socket.on('user_offline',      onUserOffline);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message',       onNewMessage);
      socket.off('message_edited',    onMessageEdited);
      socket.off('message_deleted',   onMessageDeleted);
      socket.off('reaction_updated',  onReactionUpdated);
      socket.off('message_read',      onMessageRead);
      socket.off('message_delivered', onMessageDelivered);
      socket.off('typing',            onTyping);
      socket.off('stop_typing',       onStopTyping);
      socket.off('user_online',       onUserOnline);
      socket.off('user_offline',      onUserOffline);
    };
  }, [conversationId]);

  // ── Data fetch ────────────────────────────────────────────────────────────────
  async function fetchMessages(p: number) {
    try {
      const { data } = await api.get(`/api/messages/${conversationId}?page=${p}&limit=${MESSAGE_PAGE_SIZE}`);
      if (p === 1) setMessages(conversationId, data.messages);
      else prependMessages(conversationId, data.messages);
      setTotalPages(data.totalPages);
      setPage(p);
    } catch {}
  }

  async function fetchPinnedMessage() {
    try {
      const { data } = await api.get(`/api/conversations/${conversationId}/pinned-message`);
      if (data.pinnedMessage) setPinnedMessage(data.pinnedMessage);
    } catch {}
  }

  async function loadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    await fetchMessages(page + 1);
    setLoadingMore(false);
  }

  // ── Message actions ───────────────────────────────────────────────────────────

  function handleMessageSent(msg: Message) {
    addMessage(conversationId, msg);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function openMenu(msg: Message) {
    setMenuMsg(msg);
  }

  function handleReply(msg: Message) {
    setReplyingTo(conversationId, msg);
    setMenuMsg(null);
  }

  async function handleReact(emoji: string) {
    if (!menuMsg) return;
    try { await api.post(`/api/messages/${menuMsg._id}/react`, { emoji }); } catch {}
  }

  async function handleBubbleReact(messageId: string, emoji: string) {
    try { await api.post(`/api/messages/${messageId}/react`, { emoji }); } catch {}
  }

  async function handlePin(msg: Message) {
    try {
      await api.post(`/api/messages/${msg._id}/pin`);
      setPinnedMessage(msg);
    } catch {}
  }

  async function unpinMessage() {
    if (!pinnedMessage) return;
    try {
      await api.delete(`/api/messages/${pinnedMessage._id}/pin`);
      setPinnedMessage(null);
    } catch {}
  }

  function scrollToPinnedMessage() {
    if (!pinnedMessage) return;
    const idx = flatData.findIndex((d) => '_id' in d && d._id === pinnedMessage._id);
    if (idx >= 0) {
      flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  }

  async function doDelete(msg: Message, mode: 'me' | 'everyone') {
    try {
      await api.delete(`/api/messages/${msg._id}`, { data: { deleteFor: mode } });
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message ?? 'Failed to delete');
    }
  }

  async function doEdit(content: string) {
    if (!editingMsg) return;
    try {
      await api.patch(`/api/messages/${editingMsg._id}`, { content });
      setEditingMsg(null);
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message ?? 'Failed to edit');
    }
  }

  // Build context menu actions for the selected message
  function buildActions(msg: Message): ContextAction[] {
    const isSender    = msg.sender._id === user?.id;
    const isText      = msg.type === 'text';
    const ageMins     = (Date.now() - new Date(msg.createdAt).getTime()) / 60_000;
    const canDeleteAll = (isSender || user?.role === 'admin') && ageMins <= 15;

    const actions: ContextAction[] = [
      {
        label:   'Reply',
        icon:    'corner-up-left',
        onPress: () => handleReply(msg),
      },
      {
        label:   'Forward',
        icon:    'share-2',
        onPress: () => { setMenuMsg(null); setTimeout(() => setForwardMsg(msg), 80); },
      },
    ];

    if (isSender && isText) {
      actions.push({
        label:   'Edit',
        icon:    'edit-2',
        onPress: () => { setMenuMsg(null); setTimeout(() => setEditingMsg(msg), 80); },
      });
    }

    if (isText) {
      const { Share } = require('react-native');
      actions.push({
        label:   'Copy',
        icon:    'copy',
        onPress: () => Share.share({ message: msg.content ?? '' }),
      });
    }

    actions.push({
      label:   'Pin',
      icon:    'bookmark',
      onPress: () => handlePin(msg),
    });

    actions.push({
      label:       'Delete for me',
      icon:        'trash-2',
      destructive: true,
      onPress: () =>
        Alert.alert('Delete for me?', 'This message will be removed only for you.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => doDelete(msg, 'me') },
        ]),
    });

    if (isSender || user?.role === 'admin') {
      actions.push({
        label:        'Delete for everyone',
        icon:         'trash',
        destructive:  true,
        disabled:     !canDeleteAll,
        disabledHint: !canDeleteAll ? 'Only available within 15 minutes' : undefined,
        onPress: () =>
          Alert.alert(
            'Delete for everyone?',
            'This message will be removed for all members.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => doDelete(msg, 'everyone') },
            ]
          ),
      });
    }

    return actions;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const flatData = buildFlatData(messages);

  const renderItem = useCallback(({ item }: { item: FlatListItem }) => {
    if ('type' in item && item.type === 'separator') {
      return <DateSeparator date={item.date} />;
    }
    const msg      = item as Message;
    const isSent   = msg.sender._id === user?.id;
    const msgIndex = messages.indexOf(msg);
    const prevMsg  = msgIndex > 0 ? messages[msgIndex - 1] : null;
    const showAvatar = !isSent && (!prevMsg || prevMsg.sender._id !== msg.sender._id);
    return (
      <MessageBubble
        key={msg._id}
        message={msg}
        isSent={isSent}
        isGroup={isGroup}
        showAvatar={showAvatar}
        memberCount={memberCount}
        currentUserId={user?.id ?? ''}
        isAdmin={user?.role === 'admin'}
        onReply={handleReply}
        onLongPress={openMenu}
        onImagePress={setViewerUrl}
        onReact={handleBubbleReact}
        conversationId={conversationId}
      />
    );
  }, [messages, user, isGroup, memberCount, conversationId]);

  if (!conversationId) {
    router.back();
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const lastSeenText = (() => {
    if (!otherMember?.lastSeen) return 'Offline';
    const d = new Date(otherMember.lastSeen);
    return isNaN(d.getTime()) ? 'Offline' : `Last seen ${format(d, 'h:mm a')}`;
  })();

  return (
    <GestureHandlerRootView style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── HEADER ── */}
        <BlurView intensity={80} tint="dark" style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (searchMode) {
              setSearchMode(false);
              setSearchQuery('');
              setServerResults([]);
              return;
            }
            router.back();
          }}>
            <Feather name={searchMode ? 'x' : 'arrow-left'} size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          {searchMode ? (
            /* Search input */
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages…"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          ) : (
            /* Normal header */
            <>
              <View style={styles.headerInfo}>
                {/* Avatar — tap to view fullscreen */}
                <TouchableOpacity
                  onPress={() => {
                    const url = avatarUrl
                      ? avatarUrl.startsWith('http') ? avatarUrl : `${BASE_URL}${avatarUrl}`
                      : null;
                    if (url) setViewerUrl(url);
                  }}
                  disabled={!avatarUrl}
                  activeOpacity={0.8}
                >
                  <AvatarWithRing avatarUrl={avatarUrl} displayName={displayName} size={36} isOnline={isOnline} />
                </TouchableOpacity>

                {/* Name + status — tap to navigate to info screen */}
                <TouchableOpacity
                  style={styles.headerText}
                  onPress={() => {
                    if (isGroup) router.push(`/group/${conversationId}/settings`);
                    else if (otherMember) router.push(`/contact/${otherMember._id}`);
                  }}
                >
                  <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.headerStatus}>
                    {isGroup
                      ? `${memberCount} members`
                      : isOnline ? 'Online' : lastSeenText}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchMode(true)}>
                <Feather name="search" size={19} color={Colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </BlurView>

        {/* ── Search results overlay ── */}
        {searchMode && searchQuery.trim().length > 0 && (
          <View style={styles.searchResults}>
            {serverSearching ? (
              <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.noResults}>No messages found</Text>
            ) : (
              searchResults.map((msg) => (
                <TouchableOpacity
                  key={msg._id}
                  style={styles.searchResultRow}
                  onPress={() => {
                    const idx = flatData.findIndex((d) => '_id' in d && d._id === msg._id);
                    if (idx >= 0) {
                      flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                    }
                    setSearchMode(false);
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.searchResultSender}>{msg.sender.displayName}</Text>
                  <HighlightedText text={msg.content ?? ''} query={searchQuery} />
                  <Text style={styles.searchResultTime}>{format(new Date(msg.createdAt), 'h:mm a')}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── PINNED BANNER ── */}
        {pinnedMessage && (
          <PinnedBanner
            content={pinnedMessage.content}
            fileName={pinnedMessage.fileName}
            messageType={pinnedMessage.type}
            onPress={scrollToPinnedMessage}
            onUnpin={unpinMessage}
          />
        )}

        {/* ── KEYBOARD AVOIDING AREA ── */}
        <KeyboardAvoidingView
          style={styles.kavContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
        >
          <FlatList
            ref={flatRef}
            data={flatData}
            keyExtractor={(item) => ('_id' in item ? item._id : item.id)}
            renderItem={renderItem}
            style={styles.messageList}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={loadMore}
            onEndReachedThreshold={0.2}
            onScrollToIndexFailed={() => {}}
            ListHeaderComponent={
              loadingMore
                ? <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.md }} />
                : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="message-circle" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubText}>Say hello!</Text>
              </View>
            }
            onContentSizeChange={() => {
              if (page === 1) flatRef.current?.scrollToEnd({ animated: false });
            }}
          />

          <TypingIndicator users={typingUsers} />

          <InputBar
            conversationId={conversationId}
            replyingTo={replying}
            onCancelReply={() => setReplyingTo(conversationId, null)}
            onMessageSent={handleMessageSent}
            editingMessage={editingMsg}
            onCancelEdit={() => setEditingMsg(null)}
            onEditSubmit={doEdit}
          />
        </KeyboardAvoidingView>

        {/* ── CONTEXT MENU ── */}
        <MessageContextMenu
          visible={!!menuMsg}
          message={menuMsg}
          isSent={menuMsg?.sender._id === user?.id}
          actions={menuMsg ? buildActions(menuMsg) : []}
          currentUserId={user?.id ?? ''}
          onReact={handleReact}
          onClose={() => setMenuMsg(null)}
        />

      </SafeAreaView>

      {/* ── IMAGE VIEWER ── */}
      <FullscreenImageViewer
        visible={!!viewerUrl}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />

      {/* ── FORWARD PICKER ── */}
      <ForwardPicker
        visible={!!forwardMsg}
        message={forwardMsg}
        onClose={() => setForwardMsg(null)}
      />
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: Colors.bgBase },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    gap:               Spacing.sm,
    minHeight:         HEADER_HEIGHT,
  },
  backBtn:    { padding: Spacing.sm },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1 },
  headerName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  headerStatus: { color: Colors.textTertiary, fontSize: FontSize.xs },
  searchBtn:  { padding: Spacing.sm },
  searchInput: {
    flex:         1,
    color:        Colors.textPrimary,
    fontSize:     FontSize.md,
    paddingVertical: 0,
  },

  searchResults: {
    backgroundColor:  Colors.bgLayer1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    maxHeight:         280,
  },
  noResults: {
    color:     Colors.textTertiary,
    textAlign: 'center',
    padding:   Spacing.lg,
    fontSize:  FontSize.sm,
  },
  searchResultRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.glassBorder,
    gap:               2,
  },
  searchResultSender: {
    color:      Colors.primary,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  searchResultTime: {
    color:    Colors.textTertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  kavContainer:  { flex: 1 },
  messageList:   { flex: 1 },
  listContent:   { paddingTop: Spacing.md, paddingBottom: 10 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyText:    { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  emptySubText: { color: Colors.textTertiary, fontSize: FontSize.sm },
});
