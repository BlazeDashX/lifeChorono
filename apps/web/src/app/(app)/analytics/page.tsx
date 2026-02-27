'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, startOfWeek, addDays } from 'date-fns';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import MoodCalendar from '@/components/dashboard/MoodCalender';
import {
  Moon, Activity, Target, Sparkles, ChevronDown, ChevronUp,
  AlertCircle, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({
  label,
  dateRange,
  insight,
  onGenerate,
  isGenerating,
}: {
  label: string;
  dateRange: string;
  insight: Insight | null;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getRecommendationIcon = (rec: string) => {
    if (rec.toLowerCase().includes('sleep')) return <Moon className="w-3.5 h-3.5" />;
    if (rec.toLowerCase().includes('work') || rec.toLowerCase().includes('productive'))
      return <Target className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      {/* Card Header */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{label}</p>
          <p className="text-xs text-neutral mt-0.5">{dateRange}</p>
        </div>

        <div className="flex items-center gap-3">
          {insight ? (
            <>
              <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${getScoreBg(insight.balanceScore)} ${getScoreColor(insight.balanceScore)}`}>
                {insight.balanceScore}/100
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-neutral hover:text-white transition-colors"
              >
                {expanded
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />
                }
              </button>
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-xs bg-brand/20 text-brand 
                         border border-brand/30 hover:bg-brand/30 px-3 py-1.5 
                         rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                : <><Sparkles className="w-3 h-3" /> Generate</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Expanded insight details */}
      {insight && expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-4">
          <p className="text-sm text-neutral leading-relaxed">{insight.summary}</p>

          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                Recommendations
              </p>
              {insight.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-slate-800/30 p-2.5 rounded-lg">
                  <div className="text-brand mt-0.5">{getRecommendationIcon(rec)}</div>
                  <p className="text-xs text-neutral flex-1">{rec}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-neutral/50">
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* No insight placeholder */}
      {!insight && !isGenerating && (
        <div className="px-4 pb-4">
          <p className="text-xs text-neutral/50 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            No insight generated yet — click Generate to analyze this period
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState(30);
  const [insightTab, setInsightTab] = useState<'weekly' | 'monthly'>('weekly');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  const startDate = subDays(new Date(), dateRange);
  const endDate = new Date();

  // ── Entries query ──
  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['analytics-entries', dateRange],
    queryFn: () =>
      api
        .get(`/entries?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`)
        .then(res => res.data),
  });

  // ── Weekly history query ──
  const { data: weeklyHistory = [], refetch: refetchWeekly } = useQuery<WeekPeriod[]>({
    queryKey: ['weekly-history'],
    queryFn: () => api.get('/ai-insights/weekly-history').then(res => res.data),
  });

  // ── Monthly history query ──
  const { data: monthlyHistory = [], refetch: refetchMonthly } = useQuery<MonthPeriod[]>({
    queryKey: ['monthly-history'],
    queryFn: () => api.get('/ai-insights/monthly-history').then(res => res.data),
  });

  // ── Generate week mutation ──
  const generateWeek = useMutation({
    mutationFn: (weeksBack: number) =>
      api.post(`/ai-insights/generate-week?weeksBack=${weeksBack}`).then(res => res.data),
    onSuccess: () => refetchWeekly(),
    onSettled: () => setGeneratingKey(null),
  });

  // ── Generate month mutation ──
  const generateMonth = useMutation({
    mutationFn: (monthsBack: number) =>
      api.post(`/ai-insights/generate-month?monthsBack=${monthsBack}`).then(res => res.data),
    onSuccess: () => refetchMonthly(),
    onSettled: () => setGeneratingKey(null),
  });

  // ── Analytics calculations ──
  const totalHours = entries.reduce((sum, e) => sum + e.durationMinutes / 60, 0);
  const avgDailyHours = totalHours / dateRange;
  const categoryBreakdown = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.durationMinutes / 60;
    return acc;
  }, {} as Record<string, number>);
  const moodData = entries
    .filter(e => e.moodScore)
    .map(e => ({ date: e.date, score: e.moodScore! }));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-neutral animate-pulse">Loading analytics...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 pb-24 space-y-8">

        {/* Header */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800">
          <h1 className="text-2xl font-bold text-white mb-4">Analytics</h1>
          <div className="flex gap-2">
            {[7, 14, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDateRange(days)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  dateRange === days
                    ? 'bg-brand text-white'
                    : 'bg-slate-800 text-neutral hover:bg-slate-700'
                }`}
              >
                {days === 7 ? 'Week' : days === 14 ? '2 Weeks' : days === 30 ? 'Month' : '3 Months'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Hours', value: totalHours.toFixed(1), sub: `Last ${dateRange} days` },
            { label: 'Daily Average', value: avgDailyHours.toFixed(1), sub: 'Hours per day' },
            { label: 'Total Entries', value: entries.length, sub: 'Activities logged' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-surface p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-neutral mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-neutral/60 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Category Breakdown */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-bold text-white mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(categoryBreakdown).map(([category, hours]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-white capitalize text-sm">{category}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(hours / totalHours) * 100}%`,
                        backgroundColor:
                          category === 'productive' ? '#10B981' :
                          category === 'leisure' ? '#F59E0B' :
                          category === 'restoration' ? '#06B6D4' : '#64748B',
                      }}
                    />
                  </div>
                  <span className="text-neutral text-sm w-12 text-right">{hours.toFixed(1)}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mood Calendar */}
        {moodData.length > 0 && (
          <div className="bg-surface p-6 rounded-xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Mood Heatmap</h3>
            <MoodCalendar data={moodData} />
          </div>
        )}

        {/* Historical AI Insights */}
        <div className="bg-surface p-6 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">Historical Insights</h3>
            {/* Weekly / Monthly toggle */}
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              {(['weekly', 'monthly'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInsightTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    insightTab === tab
                      ? 'bg-brand text-white'
                      : 'text-neutral hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly cards */}
          {insightTab === 'weekly' && (
            <div className="space-y-3">
              {weeklyHistory.map((period, i) => {
                const key = `week-${i + 1}`;
                const start = new Date(period.weekStart);
                const end = new Date(period.weekEnd);
                const dateRange = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
                return (
                  <InsightCard
                    key={key}
                    label={period.label}
                    dateRange={dateRange}
                    insight={period.insight}
                    isGenerating={generatingKey === key}
                    onGenerate={() => {
                      setGeneratingKey(key);
                      generateWeek.mutate(i + 1);
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Monthly cards */}
          {insightTab === 'monthly' && (
            <div className="space-y-3">
              {monthlyHistory.map((period, i) => {
                const key = `month-${i + 1}`;
                const start = new Date(period.monthStart);
                const end = new Date(period.monthEnd);
                const dateRange = `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
                return (
                  <InsightCard
                    key={key}
                    label={period.label}
                    dateRange={dateRange}
                    insight={period.insight}
                    isGenerating={generatingKey === key}
                    onGenerate={() => {
                      setGeneratingKey(key);
                      generateMonth.mutate(i + 1);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}