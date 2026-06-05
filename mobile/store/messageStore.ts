import { create } from 'zustand';

export interface Reaction {
  emoji: string;
  users: string[];
}

export interface Message {
  _id: string;
  conversation: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  type: 'text' | 'file';
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  replyTo: {
    _id: string;
    content: string | null;
    fileName: string | null;
    type: 'text' | 'file';
    sender: { _id: string; displayName: string };
  } | null;
  reactions: Reaction[];
  readBy: string[];
  deliveredTo: string[];
  deletedForAll: boolean;
  isEdited:    boolean;
  isPinned:    boolean;
  isForwarded: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TypingUser {
  id: string;
  displayName: string;
}

interface MessageStore {
  messagesByConversation: Record<string, Message[]>;
  typingUsers: Record<string, TypingUser[]>;
  replyingTo: Record<string, Message | null>;

  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, changes: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  setTyping: (conversationId: string, user: TypingUser) => void;
  clearTyping: (conversationId: string, userId: string) => void;
  setReplyingTo: (conversationId: string, message: Message | null) => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messagesByConversation: {},
  typingUsers: {},
  replyingTo: {},

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),

  prependMessages: (conversationId, messages) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      const existingIds = new Set(existing.map((m) => m._id));
      const newMessages = messages.filter((m) => !existingIds.has(m._id));
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...newMessages, ...existing],
        },
      };
    }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      if (existing.some((m) => m._id === message._id)) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, message],
        },
      };
    }),

  updateMessage: (conversationId, messageId, changes) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((m) =>
          m._id === messageId ? { ...m, ...changes } : m
        ),
      },
    })),

  deleteMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).filter(
          (m) => m._id !== messageId
        ),
      },
    })),

  setTyping: (conversationId, user) =>
    set((state) => {
      const current = state.typingUsers[conversationId] ?? [];
      if (current.some((u) => u.id === user.id)) return state;
      return {
        typingUsers: { ...state.typingUsers, [conversationId]: [...current, user] },
      };
    }),

  clearTyping: (conversationId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: (state.typingUsers[conversationId] ?? []).filter((u) => u.id !== userId),
      },
    })),

  setReplyingTo: (conversationId, message) =>
    set((state) => ({
      replyingTo: { ...state.replyingTo, [conversationId]: message },
    })),
}));
