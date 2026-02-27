'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, startOfWeek, subWeeks } from 'date-fns';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import {
  Moon, Activity, Target, Sparkles,
  ChevronDown, ChevronUp, AlertCircle, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';

interface TimeEntry {
  id: string;
  title: string;
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

const CATEGORY_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981' },
  leisure:     { label: 'Leisure',     color: '#F59E0B' },
  restoration: { label: 'Restoration', color: '#06B6D4' },
  neutral:     { label: 'Neutral',     color: '#64748B' },
} as const;

const CARD_STYLE = {
  backgroundColor: '#0F0F1A',
  border: '1px solid #1A1A2E',
};

function InsightCard({ label, dateRange, insight, onGenerate, isGenerating }: {
  label: string;
  dateRange: string;
  insight: Insight | null;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (s: number) => s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#f87171';
  const getScoreBg   = (s: number) =>
    s >= 80
      ? 'rgba(16,185,129,0.1)'
      : s >= 60
      ? 'rgba(245,158,11,0.1)'
      : 'rgba(248,113,113,0.1)';

  const getIcon = (rec: string) => {
    if (rec.toLowerCase().includes('sleep')) return <Moon className="w-3.5 h-3.5" />;
    if (rec.toLowerCase().includes('work') || rec.toLowerCase().includes('productive'))
      return <Target className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#14142A', border: '1px solid #1A1A2E' }}>
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
                  backgroundColor: getScoreBg(insight.balanceScore),
                  color: getScoreColor(insight.balanceScore),
                  border: `1px solid ${getScoreColor(insight.balanceScore)}30`,
                }}
              >
                {insight.balanceScore}/100
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ color: '#9896B8' }}
              >
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
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg"
                  style={{ backgroundColor: 'rgba(26,26,46,0.6)' }}
                >
                  <div className="mt-0.5 shrink-0" style={{ color: '#7C3AED' }}>{getIcon(rec)}</div>
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
            <AlertCircle className="w-3.5 h-3.5" />
            No insight generated yet
          </p>
        </div>
      )}
    </div>
  );
}

function GoalHitRate({ weeklyGoalData }: { weeklyGoalData: WeeklyGoalData[] }) {
  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;

  return (
    <div className="p-6 rounded-xl space-y-4" style={CARD_STYLE}>
      <div>
        <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>Goal Hit Rate</h3>
        <p className="text-sm mt-0.5" style={{ color: '#9896B8' }}>
          Did you hit your weekly goals over the last 4 weeks?
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <td className="text-xs pb-3 pr-4 w-28" style={{ color: '#9896B8' }}>Category</td>
              {weeklyGoalData.map(week => (
                <td key={week.weekStart} className="text-xs pb-3 text-center" style={{ color: '#9896B8' }}>
                  {week.weekLabel}
                </td>
              ))}
              <td className="text-xs pb-3 text-center pl-4" style={{ color: '#9896B8' }}>Rate</td>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const hits = weeklyGoalData.filter(w => w[cat].met).length;
              const hitRate = Math.round((hits / weeklyGoalData.length) * 100);

              return (
                <tr key={cat} style={{ borderTop: '1px solid #1A1A2E' }}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                      <span className="text-xs" style={{ color: '#F1F0FF' }}>{config.label}</span>
                    </div>
                  </td>
                  {weeklyGoalData.map(week => (
                    <td key={week.weekStart} className="py-3 text-center">
                      {week[cat].met ? (
                        <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: '#10B981' }} />
                      ) : week[cat].logged > 0 ? (
                        <span className="text-xs font-bold" style={{ color: config.color }}>
                          {week[cat].percent}%
                        </span>
                      ) : (
                        <XCircle className="w-4 h-4 mx-auto" style={{ color: '#2A2A3E' }} />
                      )}
                    </td>
                  ))}
                  <td className="py-3 text-center pl-4">
                    <span
                      className="text-xs font-bold"
                      style={{ color: hitRate >= 75 ? '#10B981' : hitRate >= 50 ? '#F59E0B' : '#9896B8' }}
                    >
                      {hits}/{weeklyGoalData.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center gap-4 pt-2 text-xs"
        style={{ borderTop: '1px solid #1A1A2E', color: '#9896B8' }}
      >
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#10B981' }} /> Goal met
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color: '#F59E0B' }}>75%</span> Partial
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" style={{ color: '#2A2A3E' }} /> Not logged
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState(30);
  const [insightTab, setInsightTab] = useState<'weekly' | 'monthly'>('weekly');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const startDate = subDays(new Date(), dateRange);
  const endDate = new Date();

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['analytics-entries', dateRange],
    queryFn: () =>
      api.get(`/entries?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`)
         .then(res => res.data),
  });

  const { data: weeklyGoalData = [] } = useQuery<WeeklyGoalData[]>({
    queryKey: ['weekly-goal-history'],
    queryFn: async () => {
      const results: WeeklyGoalData[] = [];
      for (let i = 1; i <= 4; i++) {
        const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const res = await api.get(`/dashboard/week?weekStart=${weekStartStr}`);
        const d = res.data;
        results.push({
          weekStart: weekStartStr,
          weekLabel: format(weekStart, 'MMM d'),
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
    queryFn: () => api.get('/ai-insights/weekly-history').then(res => res.data),
  });

  const { data: monthlyHistory = [], refetch: refetchMonthly } = useQuery<MonthPeriod[]>({
    queryKey: ['monthly-history'],
    queryFn: () => api.get('/ai-insights/monthly-history').then(res => res.data),
  });

  const generateWeek = useMutation({
    mutationFn: (weeksBack: number) =>
      api.post(`/ai-insights/generate-week?weeksBack=${weeksBack}`).then(res => res.data),
    onSuccess: () => refetchWeekly(),
    onSettled: () => setGeneratingKey(null),
  });

  const generateMonth = useMutation({
    mutationFn: (monthsBack: number) =>
      api.post(`/ai-insights/generate-month?monthsBack=${monthsBack}`).then(res => res.data),
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

  // Top bar right slot — date range selector
const topBarRight = (
    <div className="flex gap-1.5">
      {[7, 14, 30, 90].map(days => (
        <button
          key={days}
          onClick={() => setDateRange(days)}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
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
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#7C3AED' }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-24">
        
        {/* Header Area with Date Range Selector */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#F1F0FF]">Analytics</h1>
          <div className="flex gap-1.5 bg-[#0F0F1A] p-1 rounded-lg border border-[#1A1A2E]">
            {[7, 14, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setDateRange(days)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: dateRange === days ? '#7C3AED' : 'transparent',
                  color: dateRange === days ? '#ffffff' : '#9896B8',
                }}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        
        {/* High-Level Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-xl" style={CARD_STYLE}>
            <p className="text-sm" style={{ color: '#9896B8' }}>Total Logged</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#F1F0FF' }}>
              {totalHours.toFixed(1)} <span className="text-sm font-normal text-[#9896B8]">hrs</span>
            </p>
          </div>
          <div className="p-5 rounded-xl" style={CARD_STYLE}>
            <p className="text-sm" style={{ color: '#9896B8' }}>Daily Average</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#F1F0FF' }}>
              {avgDailyHours.toFixed(1)} <span className="text-sm font-normal text-[#9896B8]">hrs/day</span>
            </p>
          </div>
        </div>

        {/* Goal Hit Rate Table */}
        {weeklyGoalData.length > 0 && (
          <GoalHitRate weeklyGoalData={weeklyGoalData} />
        )}

        {/* AI Insights Section */}
        <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
          <div className="p-4 flex gap-6 border-b" style={{ borderColor: '#1A1A2E' }}>
            <button
              onClick={() => setInsightTab('weekly')}
              className="text-sm font-medium pb-4 -mb-4 transition-colors"
              style={{
                color: insightTab === 'weekly' ? '#F1F0FF' : '#9896B8',
                borderBottom: insightTab === 'weekly' ? '2px solid #7C3AED' : '2px solid transparent'
              }}
            >
              Weekly Insights
            </button>
            <button
              onClick={() => setInsightTab('monthly')}
              className="text-sm font-medium pb-4 -mb-4 transition-colors"
              style={{
                color: insightTab === 'monthly' ? '#F1F0FF' : '#9896B8',
                borderBottom: insightTab === 'monthly' ? '2px solid #7C3AED' : '2px solid transparent'
              }}
            >
              Monthly Insights
            </button>
          </div>

          <div className="p-4 space-y-4">
            {insightTab === 'weekly' ? (
              weeklyHistory.map((period, index) => (
                <InsightCard
                  key={period.weekStart}
                  label={period.label}
                  dateRange={`${format(new Date(period.weekStart), 'MMM d')} - ${format(new Date(period.weekEnd), 'MMM d')}`}
                  insight={period.insight}
                  onGenerate={() => {
                    setGeneratingKey(`week-${index}`);
                    generateWeek.mutate(index + 1);
                  }}
                  isGenerating={generatingKey === `week-${index}`}
                />
              ))
            ) : (
              monthlyHistory.map((period, index) => (
                <InsightCard
                  key={period.monthStart}
                  label={period.label}
                  dateRange={`${format(new Date(period.monthStart), 'MMMM yyyy')}`}
                  insight={period.insight}
                  onGenerate={() => {
                    setGeneratingKey(`month-${index}`);
                    generateMonth.mutate(index + 1);
                  }}
                  isGenerating={generatingKey === `month-${index}`}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}