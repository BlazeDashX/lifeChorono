import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  accessToken: string | null;
  user: any | null; 
  setAuth: (token: string, user: any) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

// Simple localStorage persistence
const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

const getStoredUser = () => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
};

const setStoredAuth = (token: string, user: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: getStoredToken(),
  user: getStoredUser(),
  setAuth: (accessToken, user) => {
    setStoredAuth(accessToken, user);
    set({ accessToken, user });
  },
  refresh: async () => {
  try {
    const res = await api.post('/auth/refresh', {});
    const token = res.data.accessToken;
    setStoredAuth(token, getStoredUser());
    set({ accessToken: token });
  } catch (error) {
    set({ accessToken: null, user: null });
  }
},
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    set({ accessToken: null, user: null });
  },
}));