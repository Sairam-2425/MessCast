import { create } from 'zustand';

export interface ConversationMember {
  _id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen: string | null;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  type: 'text' | 'file';
  fileName: string | null;
  fileMimeType?: string | null;
  deletedForAll: boolean;
  sender: { _id: string; displayName: string };
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  members: ConversationMember[];
  groupName: string | null;
  groupAvatar: string | null;
  groupAdmins: string[];
  createdBy: string | null;
  lastMessage: LastMessage | null;
  pinnedMessage: unknown | null;
  unreadCount: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatStore {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  pinnedIds: Set<string>;
  archivedIds: Set<string>;

  setConversations: (list: Conversation[]) => void;
  setArchivedConversations: (list: Conversation[]) => void;
  addOrUpdateConversation: (conv: Conversation) => void;
  updateLastMessage: (conversationId: string, message: LastMessage) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  togglePin: (conversationId: string) => void;
  toggleArchive: (conversationId: string) => void;
  updateMemberOnlineStatus: (userId: string, isOnline: boolean, lastSeen?: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  archivedConversations: [],
  pinnedIds: new Set(),
  archivedIds: new Set(),

  setConversations: (list) => {
    const pinnedIds = new Set(list.filter((c) => c.isPinned).map((c) => c.id));
    set({ conversations: list, pinnedIds });
  },

  setArchivedConversations: (list) => set({ archivedConversations: list }),

  addOrUpdateConversation: (conv) => {
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        const updated = [...state.conversations];
        updated[idx] = conv;
        return { conversations: updated };
      }
      return { conversations: [conv, ...state.conversations] };
    });
  },

  updateLastMessage: (conversationId, message) => {
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: message, updatedAt: message.createdAt } : c
      );
      // Re-sort: pinned first, then by updatedAt descending so the active chat bubbles up
      const pinnedIds = state.pinnedIds;
      updated.sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 1 : 0;
        const bp = pinnedIds.has(b.id) ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return { conversations: updated };
    });
  },

  incrementUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    }));
  },

  resetUnread: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

  togglePin: (conversationId) => {
    set((state) => {
      const next = new Set(state.pinnedIds);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return { pinnedIds: next };
    });
  },

  toggleArchive: (conversationId) => {
    set((state) => {
      const next = new Set(state.archivedIds);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return { archivedIds: next };
    });
  },

  updateMemberOnlineStatus: (userId, isOnline, lastSeen) => {
    set((state) => ({
      conversations: state.conversations.map((c) => ({
        ...c,
        members: c.members.map((m) =>
          m._id === userId ? { ...m, isOnline, lastSeen: lastSeen ?? m.lastSeen } : m
        ),
      })),
    }));
  },
}));
