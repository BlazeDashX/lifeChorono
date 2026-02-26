import { api } from './api';

export const fetchDayEntries = async (date: string) => {
  const res = await api.get(`/entries?date=${date}`);
  return res.data;
};

export const createEntry = async (data: any) => {
  const res = await api.post('/entries', data);
  return res.data;
};