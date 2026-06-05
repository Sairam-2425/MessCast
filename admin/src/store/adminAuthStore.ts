import { create } from 'zustand';

export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: 'admin' | 'user';
}

interface AdminAuthStore {
  user: AdminUser | null;
  token: string | null;
  login: (user: AdminUser, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAdminAuthStore = create<AdminAuthStore>((set) => ({
  user: null,
  token: null,

  login: (user, token) => {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    set({ user: null, token: null });
  },

  hydrate: () => {
    const token = localStorage.getItem('adminToken');
    const userStr = localStorage.getItem('adminUser');
    if (token && userStr) {
      try {
        set({ user: JSON.parse(userStr), token });
      } catch {}
    }
  },
}));
