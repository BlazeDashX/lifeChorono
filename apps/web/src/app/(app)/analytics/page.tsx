'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, subDays, startOfWeek, subWeeks } from 'date-fns';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import MoodCalendar from '@/components/dashboard/MoodCalender';
import {
  Moon, Activity, Target, Sparkles, Trophy,
  ChevronDown, ChevronUp, AlertCircle, Loader2,
  CheckCircle2, XCircle, Flame, Calendar, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  category: string;
  durationMinutes: number;
  date: string;
  moodScore?: number;
}

interface Insight {
  id: string;
  summary: string;
  balanceScore: number;
  recommendations: string[];
  generatedAt: string;
}

interface WeekPeriod {
  weekStart: string;
  weekEnd: string;
  label: string;
  insight: Insight | null;
}

interface MonthPeriod {
  monthStart: string;
  monthEnd: string;
  label: string;
  insight: Insight | null;
}

interface GoalProgress {
  logged: number;
  goal: number;
  percent: number;
  remaining: number;
  met: boolean;
}

interface WeeklyGoalData {
  weekStart: string;
  weekLabel: string;
  productive: GoalProgress;
  leisure: GoalProgress;
  restoration: GoalProgress;
  neutral: GoalProgress;
}

interface LifetimeStats {
  userName: string;
  memberSince: string;
  memberDays: number;
  weeksTracked: number;
  totals: {
    productive: number;
    leisure: number;
    restoration: number;
    neutral: number;
    total: number;
  };
  avgConsistency: number;
  records: {
    bestProductiveWeek:  { value: number; weekStart: string } | null;
    bestRestorationWeek: { value: number; weekStart: string } | null;
    bestConsistencyWeek: { value: number; weekStart: string } | null;
    longestStreak:       { value: number; startDate: string | null; endDate: string | null };
  };
}

interface MonthlyData {
  month: string;
  productive: number;
  leisure: number;
  restoration: number;
  neutral: number;
  totalLogged: number;
}

interface MoodCorrelation {
  weekStart: string;
  avgMoodScore: number | null;
  productiveHrs: number;
  consistencyScore: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD  = { backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' };
const CARD2 = { backgroundColor: '#14142A', border: '1px solid #1A1A2E' };

const CAT_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981' },
  leisure:     { label: 'Leisure',     color: '#F59E0B' },
  restoration: { label: 'Restoration', color: '#06B6D4' },
  neutral:     { label: 'Neutral',     color: '#64748B' },
} as const;

// ─── Subcomponents ────────────────────────────────────────────────────────────

function InsightCard({ label, dateRange, insight, onGenerate, isGenerating }: {
  label: string;
  dateRange: string;
  insight: Insight | null;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = (s: number) => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#f87171';
  const scoreBg    = (s: number) =>
    s >= 80 ? 'rgba(16,185,129,0.1)' : s >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(248,113,113,0.1)';

  return (
    <div className="rounded-xl overflow-hidden" style={CARD2}>
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm" style={{ color: '#F1F0FF' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>{dateRange}</p>
        </div>
        <div className="flex items-center gap-3">
          {insight ? (
            <>
              <div
                className="px-2.5 py-1 rounded-lg text-sm font-bold"
                style={{
                  backgroundColor: scoreBg(insight.balanceScore),
                  color: scoreColor(insight.balanceScore),
                  border: `1px solid ${scoreColor(insight.balanceScore)}30`,
                }}
              >
                {insight.balanceScore}/100
              </div>
              <button onClick={() => setExpanded(!expanded)} style={{ color: '#9896B8' }}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(124,58,237,0.15)',
                color: '#7C3AED',
                border: '1px solid rgba(124,58,237,0.3)',
              }}
            >
              {isGenerating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                : <><Sparkles className="w-3 h-3" /> Generate</>
              }
            </button>
          )}
        </div>
      </div>

      {insight && expanded && (
        <div className="px-4 pb-4 space-y-3 pt-4" style={{ borderTop: '1px solid #1A1A2E' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#9896B8' }}>{insight.summary}</p>
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#F1F0FF' }}>
                Recommendations
              </p>
              {insight.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg"
                     style={{ backgroundColor: 'rgba(26,26,46,0.6)' }}>
                  <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#7C3AED' }} />
                  <p className="text-xs flex-1" style={{ color: '#9896B8' }}>{rec}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs" style={{ color: '#4A4A6A' }}>
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {!insight && !isGenerating && (
        <div className="px-4 pb-3">
          <p className="text-xs flex items-center gap-1.5" style={{ color: '#4A4A6A' }}>
            <AlertCircle className="w-3.5 h-3.5" /> No insight generated yet
          </p>
        </div>
      )}
    </div>
  );
}

function GoalHitRate({ weeklyGoalData }: { weeklyGoalData: WeeklyGoalData[] }) {
  const categories = Object.keys(CAT_CONFIG) as Array<keyof typeof CAT_CONFIG>;
  return (
    <div className="p-6 rounded-xl space-y-4" style={CARD}>
      <div>
        <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>Goal Hit Rate</h3>
        <p className="text-sm mt-0.5" style={{ color: '#9896B8' }}>Last 4 weeks</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <td className="text-xs pb-3 pr-4 w-28" style={{ color: '#9896B8' }}>Category</td>
              {weeklyGoalData.map(w => (
                <td key={w.weekStart} className="text-xs pb-3 text-center" style={{ color: '#9896B8' }}>
                  {w.weekLabel}
                </td>
              ))}
              <td className="text-xs pb-3 text-center pl-4" style={{ color: '#9896B8' }}>Rate</td>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const hits = weeklyGoalData.filter(w => w[cat].met).length;
              return (
                <tr key={cat} style={{ borderTop: '1px solid #1A1A2E' }}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_CONFIG[cat].color }} />
                      <span className="text-xs" style={{ color: '#F1F0FF' }}>{CAT_CONFIG[cat].label}</span>
                    </div>
                  </td>
                  {weeklyGoalData.map(w => (
                    <td key={w.weekStart} className="py-3 text-center">
                      {w[cat].met
                        ? <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: '#10B981' }} />
                        : w[cat].logged > 0
                        ? <span className="text-xs font-bold" style={{ color: CAT_CONFIG[cat].color }}>{w[cat].percent}%</span>
                        : <XCircle className="w-4 h-4 mx-auto" style={{ color: '#2A2A3E' }} />
                      }
                    </td>
                  ))}
                  <td className="py-3 text-center pl-4">
                    <span className="text-xs font-bold" style={{
                      color: hits >= 3 ? '#10B981' : hits >= 2 ? '#F59E0B' : '#9896B8',
                    }}>
                      {hits}/{weeklyGoalData.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Lifetime Tab ─────────────────────────────────────────────────────────────

function LifetimeTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: stats, isLoading: statsLoading } = useQuery<LifetimeStats>({
    queryKey: ['lifetime-stats'],
    queryFn: () => api.get('/lifetime/stats').then(r => r.data),
  });

  const { data: monthly = [], isLoading: monthlyLoading } = useQuery<MonthlyData[]>({
    queryKey: ['lifetime-monthly', year],
    queryFn: () => api.get(`/lifetime/monthly?year=${year}`).then(r => r.data),
  });

  const { data: moodCorr = [] } = useQuery<MoodCorrelation[]>({
    queryKey: ['lifetime-mood-correlation'],
    queryFn: () => api.get('/lifetime/mood-correlation').then(r => r.data),
  });

  if (statsLoading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 text-center" style={{ color: '#9896B8' }}>
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium" style={{ color: '#F1F0FF' }}>No lifetime data yet</p>
        <p className="text-sm mt-1">Keep logging — your story is being written</p>
      </div>
    );
  }

  const recordCards = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Best Productive Week',
      value: stats.records.bestProductiveWeek
        ? `${stats.records.bestProductiveWeek.value}h`
        : '—',
      sub: stats.records.bestProductiveWeek
        ? format(new Date(stats.records.bestProductiveWeek.weekStart), 'MMM d, yyyy')
        : 'No data yet',
      color: '#10B981',
    },
    {
      icon: <Moon className="w-5 h-5" />,
      label: 'Best Restoration Week',
      value: stats.records.bestRestorationWeek
        ? `${stats.records.bestRestorationWeek.value}h`
        : '—',
      sub: stats.records.bestRestorationWeek
        ? format(new Date(stats.records.bestRestorationWeek.weekStart), 'MMM d, yyyy')
        : 'No data yet',
      color: '#06B6D4',
    },
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      label: 'Most Consistent Week',
      value: stats.records.bestConsistencyWeek
        ? `${stats.records.bestConsistencyWeek.value}%`
        : '—',
      sub: stats.records.bestConsistencyWeek
        ? format(new Date(stats.records.bestConsistencyWeek.weekStart), 'MMM d, yyyy')
        : 'No data yet',
      color: '#7C3AED',
    },
    {
      icon: <Flame className="w-5 h-5" />,
      label: 'Longest Streak',
      value: stats.records.longestStreak.value > 0
        ? `${stats.records.longestStreak.value} days`
        : '—',
      sub: stats.records.longestStreak.startDate
        ? `${format(new Date(stats.records.longestStreak.startDate), 'MMM d')} – ${format(new Date(stats.records.longestStreak.endDate!), 'MMM d, yyyy')}`
        : 'No streak yet',
      color: '#F59E0B',
    },
  ];

  return (
    <div className="space-y-5">

      {/* Member header */}
      <div className="p-5 rounded-xl" style={CARD}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-lg font-bold" style={{ color: '#F1F0FF' }}>
              {stats.userName}'s Journey
            </p>
            <p className="text-sm mt-0.5" style={{ color: '#9896B8' }}>
              Member for <span style={{ color: '#7C3AED', fontWeight: 600 }}>{stats.memberDays} days</span>
              {' '}· since {format(new Date(stats.memberSince), 'MMM d, yyyy')}
            </p>
          </div>
          {/* Consistency gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#1A1A2E" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="6"
                  strokeDasharray={`${(stats.avgConsistency / 100) * 163.4} 163.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold" style={{ color: '#F1F0FF' }}>
                  {stats.avgConsistency.toFixed(0)}%
                </span>
              </div>
            </div>
            <p className="text-xs mt-1" style={{ color: '#9896B8' }}>Consistency</p>
          </div>
        </div>
      </div>

      {/* Total stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(CAT_CONFIG) as Array<keyof typeof CAT_CONFIG>).map(cat => (
          <div key={cat} className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_CONFIG[cat].color }} />
              <p className="text-xs" style={{ color: '#9896B8' }}>{CAT_CONFIG[cat].label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#F1F0FF' }}>
              {stats.totals[cat].toFixed(0)}
              <span className="text-sm font-normal ml-1" style={{ color: '#9896B8' }}>hrs</span>
            </p>
            <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>all time</p>
          </div>
        ))}
      </div>

      {/* Personal records */}
      <div className="p-6 rounded-xl space-y-4" style={CARD}>
        <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#F1F0FF' }}>
          <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
          Personal Records
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {recordCards.map(({ icon, label, value, sub, color }) => (
            <div key={label} className="p-4 rounded-xl space-y-2" style={CARD2}>
              <div className="flex items-center gap-2" style={{ color }}>
                {icon}
                <span className="text-xs font-medium" style={{ color: '#9896B8' }}>{label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: '#F1F0FF' }}>{value}</p>
              <p className="text-xs" style={{ color: '#4A4A6A' }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly stacked bar chart */}
      <div className="p-6 rounded-xl" style={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>Monthly Breakdown</h3>
          <div className="flex gap-1.5">
            {[currentYear - 1, currentYear].map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: year === y ? '#7C3AED' : '#14142A',
                  color: year === y ? '#ffffff' : '#9896B8',
                  border: year === y ? 'none' : '1px solid #1A1A2E',
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {monthlyLoading ? (
          <div className="h-48 shimmer rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="month"
                stroke="#4A4A6A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="#4A4A6A" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(26,26,46,0.6)' }}
                contentStyle={{
                  backgroundColor: '#0F0F1A',
                  border: '1px solid #1A1A2E',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="productive"  stackId="a" fill="#10B981" radius={[0,0,3,3]} />
              <Bar dataKey="leisure"     stackId="a" fill="#F59E0B" />
              <Bar dataKey="restoration" stackId="a" fill="#06B6D4" />
              <Bar dataKey="neutral"     stackId="a" fill="#64748B" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {(Object.keys(CAT_CONFIG) as Array<keyof typeof CAT_CONFIG>).map(cat => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_CONFIG[cat].color }} />
              <span className="text-xs" style={{ color: '#9896B8' }}>{CAT_CONFIG[cat].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mood × Productive correlation */}
      {moodCorr.length > 0 && (
        <div className="p-6 rounded-xl" style={CARD}>
          <h3 className="text-base font-bold mb-1" style={{ color: '#F1F0FF' }}>
            Mood × Productivity
          </h3>
          <p className="text-sm mb-4" style={{ color: '#9896B8' }}>
            How your mood score tracks with productive hours
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodCorr} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="weekStart"
                tickFormatter={v => format(new Date(v), 'MMM d')}
                stroke="#4A4A6A"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="#4A4A6A" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F0F1A',
                  border: '1px solid #1A1A2E',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#9896B8' }}
              />
              <Line
                type="monotone"
                dataKey="productiveHrs"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                name="Productive hrs"
              />
              <Line
                type="monotone"
                dataKey="avgMoodScore"
                stroke="#7C3AED"
                strokeWidth={2}
                dot={false}
                name="Mood score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weeks tracked */}
      <div
        className="p-4 rounded-xl flex items-center justify-between"
        style={CARD}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5" style={{ color: '#7C3AED' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#F1F0FF' }}>
              {stats.weeksTracked} weeks tracked
            </p>
            <p className="text-xs" style={{ color: '#9896B8' }}>
              {stats.totals.total.toFixed(0)} total hours logged
            </p>
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#7C3AED' }}>
          {stats.weeksTracked}
        </p>
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [mainTab, setMainTab] = useState<'analytics' | 'lifetime'>('analytics');
  const [dateRange, setDateRange] = useState(30);
  const [insightTab, setInsightTab] = useState<'weekly' | 'monthly'>('weekly');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const startDate = subDays(new Date(), dateRange);
  const endDate = new Date();

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['analytics-entries', dateRange],
    queryFn: () =>
      api.get(`/entries?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`)
         .then(r => r.data),
  });

  const { data: weeklyGoalData = [] } = useQuery<WeeklyGoalData[]>({
    queryKey: ['weekly-goal-history'],
    queryFn: async () => {
      const results: WeeklyGoalData[] = [];
      for (let i = 1; i <= 4; i++) {
        const ws = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        const res = await api.get(`/dashboard/week?weekStart=${format(ws, 'yyyy-MM-dd')}`);
        const d = res.data;
        results.push({
          weekStart: format(ws, 'yyyy-MM-dd'),
          weekLabel: format(ws, 'MMM d'),
          productive:  d.goalProgress.productive,
          leisure:     d.goalProgress.leisure,
          restoration: d.goalProgress.restoration,
          neutral:     d.goalProgress.neutral,
        });
      }
      return results;
    },
  });

  const { data: weeklyHistory = [], refetch: refetchWeekly } = useQuery<WeekPeriod[]>({
    queryKey: ['weekly-history'],
    queryFn: () => api.get('/ai-insights/weekly-history').then(r => r.data),
  });

  const { data: monthlyHistory = [], refetch: refetchMonthly } = useQuery<MonthPeriod[]>({
    queryKey: ['monthly-history'],
    queryFn: () => api.get('/ai-insights/monthly-history').then(r => r.data),
  });

  const generateWeek = useMutation({
    mutationFn: (weeksBack: number) =>
      api.post(`/ai-insights/generate-week?weeksBack=${weeksBack}`).then(r => r.data),
    onSuccess: () => refetchWeekly(),
    onSettled: () => setGeneratingKey(null),
  });

  const generateMonth = useMutation({
    mutationFn: (monthsBack: number) =>
      api.post(`/ai-insights/generate-month?monthsBack=${monthsBack}`).then(r => r.data),
    onSuccess: () => refetchMonthly(),
    onSettled: () => setGeneratingKey(null),
  });

  const totalHours = entries.reduce((sum, e) => sum + e.durationMinutes / 60, 0);
  const avgDailyHours = totalHours / dateRange;
  const categoryBreakdown = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.durationMinutes / 60;
    return acc;
  }, {} as Record<string, number>);
  const moodData = entries
    .filter(e => e.moodScore)
    .map(e => ({ date: e.date, score: e.moodScore! }));

  // Top bar right — tab switcher + date range for analytics tab
  const topBarRight = (
    <div className="flex items-center gap-3">
      {mainTab === 'analytics' && (
        <div className="flex gap-1.5">
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: dateRange === days ? '#7C3AED' : 'rgba(20,20,42,0.8)',
                color: dateRange === days ? '#ffffff' : '#9896B8',
                border: dateRange === days ? 'none' : '1px solid #1A1A2E',
              }}
            >
              {days === 7 ? '7d' : days === 14 ? '14d' : days === 30 ? '30d' : '90d'}
            </button>
          ))}
        </div>
      )}
      {/* Main tab toggle */}
      <div className="flex rounded-lg p-1 gap-1" style={{ backgroundColor: '#14142A' }}>
        {(['analytics', 'lifetime'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
            style={{
              backgroundColor: mainTab === tab ? '#7C3AED' : 'transparent',
              color: mainTab === tab ? '#ffffff' : '#9896B8',
            }}
          >
            {tab === 'lifetime' ? '🏆 Lifetime' : '📊 Analytics'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <TopBar right={topBarRight} />

      <div className="max-w-3xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* ── Analytics Tab ── */}
        {mainTab === 'analytics' && (
          <>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl shimmer" />)}
              </div>
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Hours',   value: totalHours.toFixed(1),    sub: `Last ${dateRange} days` },
                    { label: 'Daily Average', value: avgDailyHours.toFixed(1), sub: 'Hours per day'          },
                    { label: 'Total Entries', value: String(entries.length),   sub: 'Activities logged'      },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="p-4 rounded-xl" style={CARD}>
                      <p className="text-xs mb-1" style={{ color: '#9896B8' }}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color: '#F1F0FF' }}>{value}</p>
                      <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Category breakdown */}
                <div className="p-6 rounded-xl space-y-3" style={CARD}>
                  <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>
                    Category Breakdown
                  </h3>
                  {Object.entries(categoryBreakdown).length === 0 ? (
                    <p className="text-sm" style={{ color: '#9896B8' }}>No data for this period</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(categoryBreakdown).map(([cat, hours]) => (
                        <div key={cat} className="flex items-center gap-4">
                          <span className="text-sm capitalize w-24 shrink-0" style={{ color: '#F1F0FF' }}>
                            {cat}
                          </span>
                          <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: '#1A1A2E' }}>
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${(hours / totalHours) * 100}%`,
                                backgroundColor: CAT_CONFIG[cat as keyof typeof CAT_CONFIG]?.color ?? '#64748B',
                              }}
                            />
                          </div>
                          <span className="text-sm w-12 text-right shrink-0" style={{ color: '#9896B8' }}>
                            {hours.toFixed(1)}h
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Goal hit rate */}
                {weeklyGoalData.length > 0 && (
                  <GoalHitRate weeklyGoalData={weeklyGoalData} />
                )}

                {/* Mood calendar */}
                {moodData.length > 0 && (
                  <div className="p-6 rounded-xl" style={CARD}>
                    <h3 className="text-base font-bold mb-4" style={{ color: '#F1F0FF' }}>
                      Mood Heatmap
                    </h3>
                    <MoodCalendar data={moodData} />
                  </div>
                )}

                {/* Historical AI Insights */}
                <div className="p-6 rounded-xl space-y-4" style={CARD}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>
                      Historical Insights
                    </h3>
                    <div className="flex rounded-lg p-1 gap-1" style={{ backgroundColor: '#14142A' }}>
                      {(['weekly', 'monthly'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setInsightTab(tab)}
                          className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
                          style={{
                            backgroundColor: insightTab === tab ? '#7C3AED' : 'transparent',
                            color: insightTab === tab ? '#ffffff' : '#9896B8',
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {insightTab === 'weekly' && (
                    <div className="space-y-3">
                      {weeklyHistory.map((period, i) => {
                        const key = `week-${i + 1}`;
                        return (
                          <InsightCard
                            key={key}
                            label={period.label}
                            dateRange={`${format(new Date(period.weekStart), 'MMM d')} – ${format(new Date(period.weekEnd), 'MMM d, yyyy')}`}
                            insight={period.insight}
                            isGenerating={generatingKey === key}
                            onGenerate={() => { setGeneratingKey(key); generateWeek.mutate(i + 1); }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {insightTab === 'monthly' && (
                    <div className="space-y-3">
                      {monthlyHistory.map((period, i) => {
                        const key = `month-${i + 1}`;
                        return (
                          <InsightCard
                            key={key}
                            label={period.label}
                            dateRange={`${format(new Date(period.monthStart), 'MMM d')} – ${format(new Date(period.monthEnd), 'MMM d, yyyy')}`}
                            insight={period.insight}
                            isGenerating={generatingKey === key}
                            onGenerate={() => { setGeneratingKey(key); generateMonth.mutate(i + 1); }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Lifetime Tab ── */}
        {mainTab === 'lifetime' && <LifetimeTab />}

      </div>
    </AppLayout>
  );
}