import { api } from './api';

export const fetchSuggestions = async (date: string) => {
  const res = await api.get(`/recurring/suggestions?date=${date}`);
  return res.data;
};

export const fetchRecurringTasks = async () => {
  const res = await api.get('/recurring');
  return res.data;
};

export const createRecurringTask = async (data: any) => {
  const res = await api.post('/recurring', data);
  return res.data;
};