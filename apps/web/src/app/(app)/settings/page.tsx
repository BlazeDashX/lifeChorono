'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import { Save, Info } from 'lucide-react';

interface WeeklyGoals {
  productive: number;
  leisure: number;
  restoration: number;
  neutral: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  weeklyGoals: WeeklyGoals;
}

const CATEGORY_CONFIG = {
  productive: { label: 'Productive', color: '#10B981', bg: 'bg-emerald-500' },
  leisure:    { label: 'Leisure',    color: '#F59E0B', bg: 'bg-amber-500'   },
  restoration:{ label: 'Restoration',color: '#06B6D4', bg: 'bg-cyan-500'    },
  neutral:    { label: 'Neutral',    color: '#64748B', bg: 'bg-slate-500'   },
} as const;

const TOTAL_HOURS = 168;

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then(res => res.data),
  });

  const [goals, setGoals] = useState<WeeklyGoals>({
    productive: 40,
    leisure: 28,
    restoration: 56,
    neutral: 20,
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Populate from server once loaded
  useEffect(() => {
    if (user?.weeklyGoals && Object.keys(user.weeklyGoals).length) {
      setGoals(user.weeklyGoals as WeeklyGoals);
    }
  }, [user]);

  const total = goals.productive + goals.leisure + goals.restoration + goals.neutral;
  const remaining = TOTAL_HOURS - total;
  const isOverLimit = total > TOTAL_HOURS;

  const { mutate: saveGoals, isPending: isSaving } = useMutation({
    mutationFn: () => api.patch('/users/goals', goals).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to save goals');
    },
  });

  const handleChange = (category: keyof WeeklyGoals, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setGoals(prev => ({ ...prev, [category]: num }));
    setError('');
    setSaved(false);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-neutral animate-pulse">Loading settings...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto p-4 pb-24 space-y-6">

        {/* Header */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-neutral mt-1">Manage your account and weekly goals</p>
        </div>

        {/* Profile */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800 space-y-3">
          <h2 className="text-lg font-bold text-white">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-lg">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{user?.name}</p>
              <p className="text-sm text-neutral">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Weekly Goals */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Weekly Goals</h2>
              <p className="text-sm text-neutral mt-0.5">
                Set target hours per category for your week
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral bg-slate-800 px-2.5 py-1 rounded-lg">
              <Info className="w-3.5 h-3.5" />
              168 hrs/week
            </div>
          </div>

          {/* Hour inputs */}
          <div className="space-y-4">
            {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(cat => {
              const config = CATEGORY_CONFIG[cat];
              return (
                <div key={cat} className="flex items-center gap-4">
                  {/* Color dot + label */}
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${config.bg}`} />
                    <span className="text-sm text-white">{config.label}</span>
                  </div>

                  {/* Input */}
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={goals[cat]}
                    onChange={e => handleChange(cat, e.target.value)}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 
                               text-white text-sm text-center focus:outline-none 
                               focus:border-brand transition-colors"
                  />

                  {/* Mini bar */}
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((goals[cat] / TOTAL_HOURS) * 100, 100)}%`,
                        backgroundColor: config.color,
                      }}
                    />
                  </div>

                  <span className="text-xs text-neutral w-8 text-right shrink-0">
                    {goals[cat]}h
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live sum bar */}
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-neutral">Total allocated</span>
              <span className={isOverLimit ? 'text-red-500 font-bold' : 'text-white font-bold'}>
                {total}h / 168h
              </span>
            </div>

            {/* Stacked bar */}
            <div className="w-full bg-slate-700 rounded-full h-3 flex overflow-hidden">
              {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(cat => (
                <div
                  key={cat}
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min((goals[cat] / TOTAL_HOURS) * 100, 100)}%`,
                    backgroundColor: CATEGORY_CONFIG[cat].color,
                  }}
                />
              ))}
            </div>

            <div className="flex justify-between text-xs">
              <span className={remaining < 0 ? 'text-red-500' : 'text-neutral'}>
                {remaining >= 0
                  ? `${remaining}h unallocated`
                  : `${Math.abs(remaining)}h over limit`
                }
              </span>
              <span className="text-neutral/60">Max 168h per week</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 
                            px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={() => !isOverLimit && saveGoals()}
            disabled={isSaving || isOverLimit}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg 
                        font-medium text-sm transition-all
                        ${saved
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                          : isOverLimit
                          ? 'bg-slate-700 text-neutral cursor-not-allowed'
                          : 'bg-brand text-white hover:bg-brand/90'
                        } disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Goals'}
          </button>
        </div>

      </div>
    </AppLayout>
  );
}