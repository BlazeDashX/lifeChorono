'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AlertCircle, Moon, Activity, Target, RefreshCw, Calendar } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';

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

  // Current week date range label
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
    },
  });

  const isFallback = insight?.summary?.includes('temporarily unavailable');

  const getRecommendationIcon = (rec: string) => {
    if (rec.toLowerCase().includes('sleep')) return <Moon className="w-4 h-4" />;
    if (rec.toLowerCase().includes('work') || rec.toLowerCase().includes('productive'))
      return <Target className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

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

  if (isLoading) {
    return (
      <div className="bg-surface p-6 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">AI Insights</h3>
          <span className="text-xs text-neutral">{weekLabel}</span>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-white">AI Insights</h3>
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all
            ${isFallback
              ? 'bg-brand/20 text-brand border border-brand/30 hover:bg-brand/30'
              : 'bg-slate-800 text-neutral hover:text-white hover:bg-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Generating...' : isFallback ? 'Retry with AI' : 'Refresh'}
        </button>
      </div>

      {/* Week label */}
      <div className="flex items-center gap-1.5 text-xs text-neutral mb-4">
        <Calendar className="w-3 h-3" />
        <span>{weekLabel}</span>
      </div>

      {/* Fallback warning */}
      {isFallback && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20
                        text-yellow-500 text-xs px-3 py-2 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Showing basic analysis — click "Retry with AI" for Gemini-powered insights</span>
        </div>
      )}

      {insight ? (
        <div className="space-y-4">
          {/* Balance Score */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${getScoreBg(insight.balanceScore)}`}>
            <span className="text-sm text-neutral">Balance Score</span>
            <span className={`text-2xl font-bold ${getScoreColor(insight.balanceScore)}`}>
              {insight.balanceScore}<span className="text-sm font-normal text-neutral">/100</span>
            </span>
          </div>

          {/* Summary */}
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <p className="text-neutral text-sm leading-relaxed">{insight.summary}</p>
          </div>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Recommendations</h4>
              {insight.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 bg-slate-800/30 p-3 rounded-lg">
                  <div className="text-brand mt-0.5">{getRecommendationIcon(rec)}</div>
                  <p className="text-sm text-neutral flex-1">{rec}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-neutral/60">
            Generated {new Date(insight.generatedAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-neutral/40 mx-auto mb-3" />
          <p className="text-neutral">No data logged this week yet</p>
          <p className="text-xs text-neutral/60 mt-1">
            Start logging activities to get AI-powered insights
          </p>
        </div>
      )}
    </div>
  );
}