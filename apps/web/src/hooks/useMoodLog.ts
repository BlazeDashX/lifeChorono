import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MoodLogEntry {
  id: string;
  score: number;
  note: string | null;
  createdAt: string;
}

export interface TodayMoodSummary {
  avgScore: number;
  roundedScore: number;
  count: number;
  logs: MoodLogEntry[];
}

interface CreateMoodLogPayload {
  score: number;
  note?: string;
}

async function postMoodLog(payload: CreateMoodLogPayload): Promise<MoodLogEntry> {
  const { data } = await api.post<MoodLogEntry>('/mood-logs', payload);
  return data;
}

async function getTodaySummary(): Promise<TodayMoodSummary | null> {
  // allow empty-body edge-case
  const res = await api.get<TodayMoodSummary | null | ''>('/mood-logs/today');

  // axios sometimes gives '' if response body is empty
  if (res.data === '') return null;

  return res.data;
}

export function useMoodLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postMoodLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mood-logs', 'today'] });
    },
  });
}

export function useTodayMoodSummary() {
  return useQuery({
    queryKey: ['mood-logs', 'today'],
    queryFn: getTodaySummary,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });
}