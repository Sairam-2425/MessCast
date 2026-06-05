import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { disconnectSocket } from '../lib/socket';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string | null;   // null for phone-only accounts
  phone: string | null;   // null for email-only accounts
  avatarUrl: string | null;
  role: 'user' | 'admin';
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isHydrated: boolean;
  setUser: (user: AuthUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isHydrated: false,

  setUser: async (user, token) => {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('authUser', JSON.stringify(user));
    set({ user, token });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['authToken', 'authUser']);
    disconnectSocket();
    set({ user: null, token: null });
  },

  hydrate: async () => {
    try {
      const [token, userStr] = await AsyncStorage.multiGet(['authToken', 'authUser']);
      const storedToken = token[1];
      const storedUser  = userStr[1] ? JSON.parse(userStr[1]) : null;
      if (storedToken && storedUser) {
        set({ user: storedUser, token: storedToken });
      }
    } catch {}
    set({ isHydrated: true });
  },

  updateUser: (partial) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    set({ user: updated });
    AsyncStorage.setItem('authUser', JSON.stringify(updated)).catch(() => {});
  },
}));
