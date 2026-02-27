'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Moon, Activity, Target, RefreshCw, Calendar, Sparkles } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { InsightsSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/lib/toast';
import { useEffect, useRef, useState } from 'react';

interface Insight {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  balanceScore: number;
  recommendations: string[];
  generatedAt: string;
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

// ─── Score badge with count-up ────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const displayed = useCountUp(score);

  const color =
    score >= 80 ? '#10B981' :
    score >= 60 ? '#F59E0B' :
    '#f87171';

  const bg =
    score >= 80 ? 'rgba(16,185,129,0.1)' :
    score >= 60 ? 'rgba(245,158,11,0.1)' :
    'rgba(248,113,113,0.1)';

  const label =
    score >= 80 ? 'Great balance' :
    score >= 60 ? 'Room to improve' :
    'Needs attention';

  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={{ backgroundColor: bg, border: `1px solid ${color}25` }}
    >
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color }}>
          Balance Score
        </p>
        <p className="text-xs" style={{ color: '#9896B8' }}>{label}</p>
      </div>
      <div className="text-right">
        <span
          className="text-4xl font-bold tabular-nums"
          style={{ color }}
        >
          {displayed}
        </span>
        <span className="text-sm font-normal ml-1" style={{ color: '#4A4A6A' }}>
          /100
        </span>
      </div>
    </div>
  );
}

// ─── Sparkle loading state ────────────────────────────────────────────────────

function SparkleLoader() {
  const messages = [
    'Analyzing your week...',
    'Reading your patterns...',
    'Connecting mood to time...',
    'Crafting recommendations...',
    'Almost ready...',
  ];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % messages.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4">
      {/* Animated sparkle ring */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
        />
        <div
          className="absolute inset-2 rounded-full animate-ping"
          style={{
            backgroundColor: 'rgba(124,58,237,0.1)',
            animationDelay: '0.3s',
          }}
        />
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(124,58,237,0.2)' }}
        >
          <Sparkles className="w-5 h-5 animate-pulse" style={{ color: '#7C3AED' }} />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium" style={{ color: '#F1F0FF' }}>
          LifeChrono AI is analyzing your week
        </p>
        <p
          className="text-xs transition-all duration-500"
          style={{ color: '#9896B8' }}
          key={msgIndex}
        >
          {messages[msgIndex]}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiInsights() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  // ── Check how many days this week have entries ──
  const { data: weekEntries = [] } = useQuery<{ date: string }[]>({
    queryKey: ['week-entries-count'],
    queryFn: () =>
      api
        .get(
          `/entries?startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}`,
        )
        .then(res => res.data),
  });

  const daysWithEntries = new Set(
    weekEntries.map((e: { date: string }) =>
      e.date.split('T')[0],
    ),
  ).size;

  const hasEnoughData = daysWithEntries >= 3;

  // ── Insight query ──
  const { data: insight, isLoading } = useQuery<Insight>({
    queryKey: ['ai-insights-current'],
    queryFn: () =>
      api.get('/ai-insights/current-week').then(res => res.data),
  });

  // ── Refresh mutation ──
  const { mutate: refresh, isPending: isRefreshing } = useMutation({
    mutationFn: () =>
      api.delete('/ai-insights/reset').then(res => res.data),
    onSuccess: freshData => {
      queryClient.setQueryData(['ai-insights-current'], freshData);
      toast('Insights refreshed successfully');
    },
    onError: () => {
      toast('Failed to refresh insights', 'error');
    },
  });

  const isFallback = insight?.summary?.includes('temporarily unavailable');

  const getRecommendationIcon = (rec: string) => {
    if (rec.toLowerCase().includes('sleep'))
      return <Moon className="w-4 h-4" />;
    if (
      rec.toLowerCase().includes('work') ||
      rec.toLowerCase().includes('productive')
    )
      return <Target className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  if (isLoading) return <InsightsSkeleton />;

  return (
    <div
      className="p-6 rounded-xl space-y-4"
      style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold" style={{ color: '#F1F0FF' }}>
            AI Insights
          </h3>
          <div
            className="flex items-center gap-1.5 text-xs mt-0.5"
            style={{ color: '#4A4A6A' }}
          >
            <Calendar className="w-3 h-3" />
            <span>{weekLabel}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => {
              if (!hasEnoughData) {
                toast(
                  `Log at least 3 days to generate insights (${daysWithEntries}/3 days logged)`,
                  'info',
                );
                return;
              }
              refresh();
            }}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: isFallback
                ? 'rgba(124,58,237,0.2)'
                : 'rgba(20,20,42,0.8)',
              color: isFallback ? '#7C3AED' : '#9896B8',
              border: isFallback
                ? '1px solid rgba(124,58,237,0.3)'
                : '1px solid #1A1A2E',
            }}
          >
            {isRefreshing ? (
              <>
                <Sparkles className="w-3 h-3 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                {isFallback ? 'Retry with AI' : 'Refresh'}
              </>
            )}
          </button>

          {/* Days logged indicator */}
          {!hasEnoughData && (
            <p className="text-xs" style={{ color: '#4A4A6A' }}>
              {daysWithEntries}/3 days logged
            </p>
          )}
        </div>
      </div>

      {/* Not enough data warning */}
      {!hasEnoughData && !insight && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg"
          style={{
            backgroundColor: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.2)',
            color: '#9896B8',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#7C3AED' }} />
          <span>
            Log {3 - daysWithEntries} more day{3 - daysWithEntries !== 1 ? 's' : ''} this week
            to unlock your AI insight
          </span>
        </div>
      )}

      {/* Fallback warning */}
      {isFallback && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            color: '#F59E0B',
          }}
        >
          <span>⚠️</span>
          <span>
            Showing basic analysis — click "Retry with AI" for Gemini-powered
            insights
          </span>
        </div>
      )}

      {/* Sparkle loader while generating */}
      {isRefreshing && <SparkleLoader />}

      {/* Content */}
      {!isRefreshing && insight && (
        <div className="space-y-4">
          {/* Count-up score */}
          <ScoreBadge score={insight.balanceScore} />

          {/* Summary */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: '#14142A',
              border: '1px solid #1A1A2E',
            }}
          >
            <p
              className="text-sm leading-relaxed"
              style={{ color: '#9896B8' }}
            >
              {insight.summary}
            </p>
          </div>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#F1F0FF' }}
              >
                Recommendations
              </h4>
              {insight.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: '#14142A',
                    border: '1px solid #1A1A2E',
                  }}
                >
                  <div
                    className="mt-0.5 shrink-0"
                    style={{ color: '#7C3AED' }}
                  >
                    {getRecommendationIcon(rec)}
                  </div>
                  <p
                    className="text-sm flex-1"
                    style={{ color: '#9896B8' }}
                  >
                    {rec}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs" style={{ color: '#4A4A6A' }}>
            Generated{' '}
            {new Date(insight.generatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isRefreshing && !insight && hasEnoughData && (
        <EmptyState type="empty-insights" />
      )}
    </div>
  );
}