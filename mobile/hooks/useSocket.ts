import { useEffect } from 'react';
import { connectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useMessageStore, Message } from '../store/messageStore';

export function useSocket() {
  const token  = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const { updateLastMessage, incrementUnread, updateMemberOnlineStatus } = useChatStore();
  const { addMessage, updateMessage, setTyping, clearTyping } = useMessageStore();

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    // ── Named handlers — MUST be stable (re-declared per effect run) ─────────
    // Passing named functions lets socket.off() remove only this specific
    // listener, leaving any other handlers (e.g. from chat/[id].tsx) intact.

    function onNewMessage(message: Message) {
      addMessage(message.conversation, message);
      if (message.sender._id !== userId) {
        incrementUnread(message.conversation);
      }
      updateLastMessage(message.conversation, {
        _id:          message._id,
        content:      message.content,
        type:         message.type,
        fileName:     message.fileName,
        fileMimeType: message.fileMimeType,
        deletedForAll: message.deletedForAll,
        sender:       { _id: message.sender._id, displayName: message.sender.displayName },
        createdAt:    message.createdAt,
      });
    }

    function onMessageEdited(message: Message) {
      updateMessage(message.conversation, message._id, message);
    }

    function onMessageDeleted({ messageId, conversationId, deletedForAll }: {
      messageId: string; conversationId: string; deletedForAll: boolean;
    }) {
      if (deletedForAll) {
        updateMessage(conversationId, messageId, {
          deletedForAll: true,
          content: null,
          fileUrl: null,
        });
      }
    }

    function onReactionUpdated({ messageId, reactions, conversationId }: {
      messageId: string; reactions: Message['reactions']; conversationId?: string;
    }) {
      // Try the provided conversationId first; fall back to scanning all conversations
      const store = useMessageStore.getState();
      if (conversationId && store.messagesByConversation[conversationId]?.some((m) => m._id === messageId)) {
        updateMessage(conversationId, messageId, { reactions });
        return;
      }
      for (const [convId, messages] of Object.entries(store.messagesByConversation)) {
        if (messages.some((m) => m._id === messageId)) {
          updateMessage(convId, messageId, { reactions });
          break;
        }
      }
    }

    function onMessageRead({ messageId, userId: readerId, conversationId }: {
      messageId: string; userId: string; conversationId: string;
    }) {
      const store    = useMessageStore.getState();
      const messages = store.messagesByConversation[conversationId] ?? [];
      const msg      = messages.find((m) => m._id === messageId);
      if (msg && !msg.readBy.includes(readerId)) {
        updateMessage(conversationId, messageId, { readBy: [...msg.readBy, readerId] });
      }
    }

    function onMessageDelivered({ messageId, userId: deliveredId }: {
      messageId: string; userId: string;
    }) {
      const store = useMessageStore.getState();
      for (const [convId, messages] of Object.entries(store.messagesByConversation)) {
        const msg = messages.find((m) => m._id === messageId);
        if (msg && !msg.deliveredTo.includes(deliveredId)) {
          updateMessage(convId, messageId, { deliveredTo: [...msg.deliveredTo, deliveredId] });
          break;
        }
      }
    }

    function onTyping({ conversationId, user }: {
      conversationId: string; user: { id: string; displayName: string };
    }) {
      setTyping(conversationId, user);
    }

    function onStopTyping({ conversationId, userId: typerId }: {
      conversationId: string; userId: string;
    }) {
      clearTyping(conversationId, typerId);
    }

    function onUserOnline({ userId: onlineId }: { userId: string }) {
      updateMemberOnlineStatus(onlineId, true);
    }

    function onUserOffline({ userId: offlineId, lastSeen }: {
      userId: string; lastSeen: string;
    }) {
      updateMemberOnlineStatus(offlineId, false, lastSeen);
    }

    function onForceLogout() {
      useAuthStore.getState().logout();
    }

    // Register
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
    socket.on('force_logout',      onForceLogout);

    return () => {
      // Off with handler refs — only removes THIS hook's listeners
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
      socket.off('force_logout',      onForceLogout);
    };
  }, [token, userId]);
}
