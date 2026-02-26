import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-retry with refresh token on 401
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401) {
    await useAuthStore.getState().refresh();  // refresh + retry
  }
  return Promise.reject(error);
});