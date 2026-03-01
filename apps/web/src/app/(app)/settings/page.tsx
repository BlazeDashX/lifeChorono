'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { Save, Info, Heart } from 'lucide-react';
import { useToast } from '@/lib/toast';

interface WeeklyGoals {
  productive:  number;
  leisure:     number;
  restoration: number;
  neutral:     number;
}

interface User {
  id:          string;
  email:       string;
  name:        string;
  weeklyGoals: WeeklyGoals;
}

const CATEGORY_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981' },
  leisure:     { label: 'Leisure',     color: '#F59E0B' },
  restoration: { label: 'Restoration', color: '#06B6D4' },
  neutral:     { label: 'Neutral',     color: '#64748B' },
} as const;

const TOTAL_HOURS = 168;
const CARD        = { backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn:  () => api.get('/users/me').then(res => res.data),
  });

  const [goals, setGoals] = useState<WeeklyGoals>({
    productive: 40, leisure: 28, restoration: 56, neutral: 20,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.weeklyGoals && Object.keys(user.weeklyGoals).length) {
      setGoals(user.weeklyGoals as WeeklyGoals);
    }
  }, [user]);

  const total     = goals.productive + goals.leisure + goals.restoration + goals.neutral;
  const remaining = TOTAL_HOURS - total;
  const isOver    = total > TOTAL_HOURS;

  const { mutate: saveGoals, isPending: isSaving } = useMutation({
    mutationFn: () => api.patch('/users/goals', goals).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Goals saved successfully');
      setError('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to save goals';
      setError(msg);
      toast(msg, 'error');
    },
  });

  const handleChange = (cat: keyof WeeklyGoals, val: string) => {
    setGoals(prev => ({ ...prev, [cat]: Math.max(0, parseInt(val) || 0) }));
    setError('');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <TopBar />
        <div className="p-8 animate-pulse" style={{ color: '#9896B8' }}>Loading…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TopBar />

      <div className="max-w-xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* ── Profile ── */}
        <div className="p-6 rounded-xl space-y-4" style={CARD}>
          <h2 className="text-base font-bold" style={{ color: '#F1F0FF' }}>Profile</h2>
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center
                         font-bold text-lg shrink-0"
              style={{
                backgroundColor: 'rgba(124,58,237,0.2)',
                border:          '1px solid rgba(124,58,237,0.3)',
                color:           '#7C3AED',
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium" style={{ color: '#F1F0FF' }}>{user?.name}</p>
              <p className="text-sm"     style={{ color: '#9896B8' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* ── Weekly Goals ── */}
        <div className="p-6 rounded-xl space-y-5" style={CARD}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: '#F1F0FF' }}>
                Weekly Goals
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#9896B8' }}>
                Set target hours per category
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: '#14142A', color: '#9896B8', border: '1px solid #1A1A2E' }}
            >
              <Info className="w-3.5 h-3.5" />
              168 hrs/week
            </div>
          </div>

          <div className="space-y-4">
            {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="text-sm" style={{ color: '#F1F0FF' }}>{cfg.label}</span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={168}
                    value={goals[cat]}
                    onChange={e => handleChange(cat, e.target.value)}
                    className="w-20 rounded-lg px-3 py-2 text-sm text-center
                               focus:outline-none transition-colors"
                    style={{ backgroundColor: '#14142A', border: '1px solid #1A1A2E', color: '#F1F0FF' }}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')}
                    onBlur={e  => (e.target.style.borderColor = '#1A1A2E')}
                  />
                  <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: '#1A1A2E' }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width:           `${Math.min((goals[cat] / TOTAL_HOURS) * 100, 100)}%`,
                        backgroundColor: cfg.color,
                      }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right shrink-0" style={{ color: '#9896B8' }}>
                    {goals[cat]}h
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total bar */}
          <div className="space-y-2 pt-3" style={{ borderTop: '1px solid #1A1A2E' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#9896B8' }}>Total allocated</span>
              <span
                className="font-bold"
                style={{ color: isOver ? '#f87171' : '#F1F0FF' }}
              >
                {total}h / 168h
              </span>
            </div>
            <div
              className="w-full rounded-full h-2.5 flex overflow-hidden"
              style={{ backgroundColor: '#1A1A2E' }}
            >
              {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(cat => (
                <div
                  key={cat}
                  className="h-full transition-all"
                  style={{
                    width:           `${Math.min((goals[cat] / TOTAL_HOURS) * 100, 100)}%`,
                    backgroundColor: CATEGORY_CONFIG[cat].color,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: remaining < 0 ? '#f87171' : '#9896B8' }}>
                {remaining >= 0
                  ? `${remaining}h unallocated`
                  : `${Math.abs(remaining)}h over limit`}
              </span>
              <span style={{ color: '#4A4A6A' }}>Max 168h per week</span>
            </div>
          </div>

          {error && (
            <div
              className="text-sm px-3 py-2 rounded-lg"
              style={{
                color:           '#f87171',
                backgroundColor: 'rgba(248,113,113,0.1)',
                border:          '1px solid rgba(248,113,113,0.2)',
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={() => !isOver && saveGoals()}
            disabled={isSaving || isOver}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                       font-medium text-sm transition-all disabled:opacity-50"
            style={{
              backgroundColor: isOver ? '#14142A' : '#7C3AED',
              color:           isOver ? '#9896B8' : '#ffffff',
              cursor:          isOver ? 'not-allowed' : 'pointer',
            }}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save Goals'}
          </button>
        </div>

        {/* ── Support & Wellbeing ───────────────────────────────────────────
            Always visible. LifeChrono is not a therapy service.
            A door must always be open.
        ── */}
        <div className="p-5 rounded-xl space-y-3" style={CARD}>
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" style={{ color: '#7C3AED' }} />
            <h2 className="text-sm font-bold" style={{ color: '#F1F0FF' }}>
              Support & Wellbeing
            </h2>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: '#9896B8' }}>
            LifeChrono is a self-awareness companion — not a therapy service, crisis
            service, or medical device. If you are going through a difficult time,
            please reach out to a professional or someone you trust.
          </p>

          <div className="space-y-2 pt-1">
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-3 py-2.5
                         rounded-lg text-xs transition-all"
              style={{
                backgroundColor: 'rgba(124,58,237,0.08)',
                border:          '1px solid rgba(124,58,237,0.2)',
                color:           '#A78BFA',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.15)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.08)')}
            >
              <span>Find a crisis helpline in your country</span>
              <span style={{ color: '#4A4A6A' }}>↗</span>
            </a>

            <a
              href="https://www.befrienders.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-3 py-2.5
                         rounded-lg text-xs transition-all"
              style={{
                backgroundColor: 'rgba(124,58,237,0.08)',
                border:          '1px solid rgba(124,58,237,0.2)',
                color:           '#A78BFA',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.15)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.08)')}
            >
              <span>Befrienders Worldwide — emotional support</span>
              <span style={{ color: '#4A4A6A' }}>↗</span>
            </a>
          </div>

          <p className="text-xs pt-1" style={{ color: '#4A4A6A' }}>
            Your data in LifeChrono is private and belongs only to you.
          </p>
        </div>

      </div>
    </AppLayout>
  );
}