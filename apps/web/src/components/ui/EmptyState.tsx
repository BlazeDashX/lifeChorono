import { Clock, Brain, Sparkles } from 'lucide-react';

const STATES = {
  'empty-day': {
    icon:    <Clock className="w-10 h-10 text-text-muted" />,
    title:   'Nothing logged yet',
    message: 'Tap + to start your day',
    sub:     null,
  },
  'empty-insights': {
    icon:    <Brain className="w-10 h-10 text-text-muted" />,
    title:   'No insights yet',
    message: 'Log at least 3 days this week to unlock your AI insight',
    sub:     'Insights are generated automatically once you have enough data',
  },
  'empty-lifetime': {
    icon:    <Sparkles className="w-10 h-10 text-brand/60" />,
    title:   'Your story starts now',
    message: 'Keep logging to see your patterns unfold',
    sub:     null,
  },
  'empty-analytics': {
    icon:    <Sparkles className="w-10 h-10 text-text-muted" />,
    title:   'No data for this period',
    message: 'Start logging activities to see your analytics',
    sub:     null,
  },
} as const;

type EmptyStateType = keyof typeof STATES;

export default function EmptyState({ type }: { type: EmptyStateType }) {
  const state = STATES[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
      <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-surface-border
                      flex items-center justify-center mb-2">
        {state.icon}
      </div>
      <h3 className="text-text-primary font-semibold">{state.title}</h3>
      <p className="text-text-secondary text-sm max-w-xs">{state.message}</p>
      {state.sub && (
        <p className="text-text-muted text-xs max-w-xs">{state.sub}</p>
      )}
    </div>
  );
}