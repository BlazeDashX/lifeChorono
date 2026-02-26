import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../../env-config';

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
      const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
      set({ accessToken: res.data.accessToken });
    } catch (error) {
      set({ accessToken: null, user: null });
    }
  },
  logout: () => set({ accessToken: null, user: null }),
}));