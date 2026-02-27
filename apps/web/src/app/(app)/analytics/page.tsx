'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, startOfWeek, addDays, subWeeks } from 'date-fns';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import MoodCalendar from '@/components/dashboard/MoodCalender';
import {
  Moon, Activity, Target, Sparkles,
  ChevronDown, ChevronUp, AlertCircle, Loader2, CheckCircle2, XCircle,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981' },
  leisure:     { label: 'Leisure',     color: '#F59E0B' },
  restoration: { label: 'Restoration', color: '#06B6D4' },
  neutral:     { label: 'Neutral',     color: '#64748B' },
} as const;

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({
  label, dateRange, insight, onGenerate, isGenerating,
}: {
  label: string;
  dateRange: string;
  insight: Insight | null;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (score: number) =>
    score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500';

  const getScoreBg = (score: number) =>
    score >= 80
      ? 'bg-green-500/10 border-green-500/20'
      : score >= 60
      ? 'bg-yellow-500/10 border-yellow-500/20'
      : 'bg-red-500/10 border-red-500/20';

  const getIcon = (rec: string) => {
    if (rec.toLowerCase().includes('sleep')) return <Moon className="w-3.5 h-3.5" />;
    if (rec.toLowerCase().includes('work') || rec.toLowerCase().includes('productive'))
      return <Target className="w-3.5 h-3.5" />;
    return <Activity className="w-3.5 h-3.5" />;
  };

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{label}</p>
          <p className="text-xs text-neutral mt-0.5">{dateRange}</p>
        </div>
        <div className="flex items-center gap-3">
          {insight ? (
            <>
              <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold 
                               ${getScoreBg(insight.balanceScore)} 
                               ${getScoreColor(insight.balanceScore)}`}>
                {insight.balanceScore}/100
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-neutral hover:text-white transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-xs bg-brand/20 text-brand
                         border border-brand/30 hover:bg-brand/30 px-3 py-1.5
                         rounded-lg transition-all disabled:opacity-50"
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
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-4">
          <p className="text-sm text-neutral leading-relaxed">{insight.summary}</p>
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                Recommendations
              </p>
              {insight.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-slate-800/50 p-2.5 rounded-lg">
                  <div className="text-brand mt-0.5">{getIcon(rec)}</div>
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

      {!insight && !isGenerating && (
        <div className="px-4 pb-3">
          <p className="text-xs text-neutral/50 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            No insight generated yet
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Goal Hit Rate ────────────────────────────────────────────────────────────

function GoalHitRate({ weeklyGoalData }: { weeklyGoalData: WeeklyGoalData[] }) {
  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-800 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white">Goal Hit Rate</h3>
        <p className="text-sm text-neutral mt-0.5">
          Did you hit your weekly goals over the last 4 weeks?
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <td className="text-neutral text-xs pb-3 pr-4 w-28">Category</td>
              {weeklyGoalData.map(week => (
                <td key={week.weekStart} className="text-neutral text-xs pb-3 text-center">
                  <span className="block">{week.weekLabel}</span>
                </td>
              ))}
              <td className="text-neutral text-xs pb-3 text-center pl-4">Hit Rate</td>
            </tr>
          </thead>
          <tbody className="space-y-2">
            {categories.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const hits = weeklyGoalData.filter(w => w[cat].met).length;
              const hitRate = Math.round((hits / weeklyGoalData.length) * 100);

              return (
                <tr key={cat} className="border-t border-slate-800">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-white text-xs">{config.label}</span>
                    </div>
                  </td>

                  {weeklyGoalData.map(week => (
                    <td key={week.weekStart} className="py-3 text-center">
                      {week[cat].met ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : week[cat].logged > 0 ? (
                        <div className="mx-auto w-4 h-4 flex items-center justify-center">
                          <span
                            className="text-xs font-bold"
                            style={{ color: config.color }}
                          >
                            {week[cat].percent}%
                          </span>
                        </div>
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                  ))}

                  <td className="py-3 text-center pl-4">
                    <span
                      className={`text-xs font-bold ${
                        hitRate >= 75
                          ? 'text-green-500'
                          : hitRate >= 50
                          ? 'text-amber-500'
                          : 'text-neutral'
                      }`}
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

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-800 text-xs text-neutral">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          Goal met
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-amber-500">75%</span>
          Partial
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5 text-slate-600" />
          Not logged
        </div>
      </div>
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

  // ── Entries ──
  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['analytics-entries', dateRange],
    queryFn: () =>
      api
        .get(`/entries?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`)
        .then(res => res.data),
  });

  // ── Weekly goal data — fetch last 4 weeks from dashboard API ──
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

  // ── Weekly history ──
  const { data: weeklyHistory = [], refetch: refetchWeekly } = useQuery<WeekPeriod[]>({
    queryKey: ['weekly-history'],
    queryFn: () => api.get('/ai-insights/weekly-history').then(res => res.data),
  });

  // ── Monthly history ──
  const { data: monthlyHistory = [], refetch: refetchMonthly } = useQuery<MonthPeriod[]>({
    queryKey: ['monthly-history'],
    queryFn: () => api.get('/ai-insights/monthly-history').then(res => res.data),
  });

  // ── Mutations ──
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

  // ── Analytics ──
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
          <div className="flex gap-2 flex-wrap">
            {[7, 14, 30, 90].map(days => (
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
            { label: 'Total Hours',   value: totalHours.toFixed(1),     sub: `Last ${dateRange} days` },
            { label: 'Daily Average', value: avgDailyHours.toFixed(1),  sub: 'Hours per day'          },
            { label: 'Total Entries', value: String(entries.length),    sub: 'Activities logged'      },
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
                          category === 'productive'  ? '#10B981' :
                          category === 'leisure'     ? '#F59E0B' :
                          category === 'restoration' ? '#06B6D4' : '#64748B',
                      }}
                    />
                  </div>
                  <span className="text-neutral text-sm w-12 text-right">
                    {hours.toFixed(1)}h
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goal Hit Rate */}
        {weeklyGoalData.length > 0 && (
          <GoalHitRate weeklyGoalData={weeklyGoalData} />
        )}

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
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              {(['weekly', 'monthly'] as const).map(tab => (
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

          {insightTab === 'weekly' && (
            <div className="space-y-3">
              {weeklyHistory.map((period, i) => {
                const key = `week-${i + 1}`;
                const start = new Date(period.weekStart);
                const end = new Date(period.weekEnd);
                return (
                  <InsightCard
                    key={key}
                    label={period.label}
                    dateRange={`${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`}
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

          {insightTab === 'monthly' && (
            <div className="space-y-3">
              {monthlyHistory.map((period, i) => {
                const key = `month-${i + 1}`;
                const start = new Date(period.monthStart);
                const end = new Date(period.monthEnd);
                return (
                  <InsightCard
                    key={key}
                    label={period.label}
                    dateRange={`${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`}
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