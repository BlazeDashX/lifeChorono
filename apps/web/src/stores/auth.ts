import { create } from 'zustand';
import axios from 'axios';

interface AuthState {
  accessToken: string | null;
  user: any | null; 
  setAuth: (token: string, user: any) => void;
  refresh: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null, 
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  refresh: async () => {
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {}, { withCredentials: true });
      set({ accessToken: res.data.accessToken });
    } catch (error) {
      set({ accessToken: null, user: null });
    }
  },
  logout: () => set({ accessToken: null, user: null }),
}));