'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Moon, Activity, Target, RefreshCw, Calendar } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { InsightsSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/lib/toast';

interface Insight {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  balanceScore: number;
  recommendations: string[];
  generatedAt: string;
}

export default function AiInsights() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  const { data: insight, isLoading } = useQuery<Insight>({
    queryKey: ['ai-insights-current'],
    queryFn: () => api.get('/ai-insights/current-week').then(res => res.data),
  });

  const { mutate: refresh, isPending: isRefreshing } = useMutation({
    mutationFn: () => api.delete('/ai-insights/reset').then(res => res.data),
    onSuccess: (freshData) => {
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
    if (rec.toLowerCase().includes('work') || rec.toLowerCase().includes('productive'))
      return <Target className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  if (isLoading) return <InsightsSkeleton />;

  return (
    <div className="bg-surface p-6 rounded-xl border border-surface-border">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-text-primary">AI Insights</h3>
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg 
                      transition-all disabled:opacity-50 disabled:cursor-not-allowed
                      ${isFallback
                        ? 'bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30'
                        : 'bg-surface-raised text-text-secondary hover:text-text-primary'
                      }`}
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Generating...' : isFallback ? 'Retry with AI' : 'Refresh'}
        </button>
      </div>

      {/* Week label */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
        <Calendar className="w-3 h-3" />
        <span>{weekLabel}</span>
      </div>

      {/* Fallback warning */}
      {isFallback && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20
                        text-yellow-500 text-xs px-3 py-2 rounded-lg mb-4">
          <span>⚠️</span>
          <span>Showing basic analysis — click "Retry with AI" for Gemini-powered insights</span>
        </div>
      )}

      {insight ? (
        <div className="space-y-4">

          {/* Balance Score */}
          <div className={`flex items-center justify-between p-3 rounded-lg border
                           ${getScoreBg(insight.balanceScore)}`}>
            <span className="text-sm text-text-secondary">Balance Score</span>
            <span className={`text-2xl font-bold ${getScoreColor(insight.balanceScore)}`}>
              {insight.balanceScore}
              <span className="text-sm font-normal text-text-muted">/100</span>
            </span>
          </div>

          {/* Summary */}
          <div className="bg-surface-raised p-4 rounded-lg border border-surface-border">
            <p className="text-text-secondary text-sm leading-relaxed">
              {insight.summary}
            </p>
          </div>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                Recommendations
              </h4>
              {insight.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-surface-raised/50 
                             border border-surface-border p-3 rounded-lg"
                >
                  <div className="text-brand mt-0.5 shrink-0">
                    {getRecommendationIcon(rec)}
                  </div>
                  <p className="text-sm text-text-secondary flex-1">{rec}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-text-muted">
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <EmptyState type="empty-insights" />
      )}
    </div>
  );
}