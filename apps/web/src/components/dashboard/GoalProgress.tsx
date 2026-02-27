'use client';

import { CheckCircle2 } from 'lucide-react';

interface CategoryGoal {
  logged: number;
  goal: number;
  percent: number;
  remaining: number;
  met: boolean;
}

interface GoalProgressProps {
  goalProgress: {
    productive: CategoryGoal;
    leisure: CategoryGoal;
    restoration: CategoryGoal;
    neutral: CategoryGoal;
  };
}

const CATEGORY_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981', track: 'bg-emerald-500' },
  leisure:     { label: 'Leisure',     color: '#F59E0B', track: 'bg-amber-500'   },
  restoration: { label: 'Restoration', color: '#06B6D4', track: 'bg-cyan-500'    },
  neutral:     { label: 'Neutral',     color: '#64748B', track: 'bg-slate-500'   },
} as const;

export default function GoalProgress({ goalProgress }: GoalProgressProps) {
  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;
  const allMet = categories.every(cat => goalProgress[cat].met);

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral uppercase tracking-wider">
          Weekly Goals
        </h3>
        {allMet && (
          <span className="flex items-center gap-1 text-xs text-green-500 
                           bg-green-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            All goals met!
          </span>
        )}
      </div>

      {/* Goal rows */}
      <div className="space-y-3">
        {categories.map(cat => {
          const config = CATEGORY_CONFIG[cat];
          const data = goalProgress[cat];
          const pct = Math.min(data.percent, 100);

          // Color logic — encouraging not punishing
          const statusColor =
            data.met
              ? 'text-green-500'
              : data.percent >= 80
              ? 'text-amber-500'
              : 'text-neutral';

          const statusText =
            data.met
              ? '✓ Done'
              : data.remaining > 0
              ? `${data.remaining.toFixed(1)}h left`
              : `${Math.abs(data.remaining).toFixed(1)}h over`;

          return (
            <div key={cat} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm text-white">{config.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral">
                    {data.logged.toFixed(1)}
                    <span className="text-neutral/50"> / {data.goal}h</span>
                  </span>
                  <span className={`text-xs font-medium w-16 text-right ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: data.met ? '#10B981' : config.color,
                    opacity: data.met ? 1 : 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}