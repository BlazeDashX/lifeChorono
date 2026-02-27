'use client';

import { format } from 'date-fns';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

interface TodaySummaryProps {
  todaySummary: {
    date: string;
    productive: number;
    leisure: number;
    restoration: number;
    neutral: number;
    totalLogged: number;
    entryCount: number;
    missing: string[];
  };
}

const CATEGORY_CONFIG = {
  productive:  { label: 'Productive',  color: '#10B981', emoji: '💼' },
  leisure:     { label: 'Leisure',     color: '#F59E0B', emoji: '🎮' },
  restoration: { label: 'Restoration', color: '#06B6D4', emoji: '😴' },
  neutral:     { label: 'Neutral',     color: '#64748B', emoji: '📋' },
} as const;

export default function TodaySummary({ todaySummary }: TodaySummaryProps) {
  const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;
  const hasAnyLogged = todaySummary.totalLogged > 0;
  const today = new Date();

  return (
    <div className="bg-surface p-6 rounded-xl border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-neutral uppercase tracking-wider">
            Today
          </h3>
          <p className="text-xs text-neutral/60 mt-0.5">
            {format(today, 'EEEE, MMM d')}
          </p>
        </div>
        <Link
          href="/log"
          className="flex items-center gap-1.5 text-xs bg-brand/20 text-brand 
                     border border-brand/30 hover:bg-brand/30 px-3 py-1.5 
                     rounded-lg transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Log Activity
        </Link>
      </div>

      {hasAnyLogged ? (
        <div className="space-y-2">
          {/* Logged categories */}
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat];
            const hours = todaySummary[cat];
            if (hours === 0) return null;

            return (
              <div
                key={cat}
                className="flex items-center justify-between 
                           bg-slate-800/40 px-3 py-2 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{config.emoji}</span>
                  <span className="text-sm text-white">{config.label}</span>
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: config.color }}
                >
                  {hours.toFixed(1)}h
                </span>
              </div>
            );
          })}

          {/* Missing category nudges */}
          {todaySummary.missing.map(cat => {
            const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
            if (!config) return null;
            return (
              <div
                key={cat}
                className="flex items-center justify-between 
                           bg-slate-800/20 px-3 py-2 rounded-lg 
                           border border-dashed border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-40">{config.emoji}</span>
                  <span className="text-sm text-neutral/50">{config.label}</span>
                </div>
                <span className="text-xs text-neutral/40">not logged</span>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex justify-between items-center pt-1 
                          border-t border-slate-700 mt-2">
            <span className="text-xs text-neutral">
              {todaySummary.entryCount} {todaySummary.entryCount === 1 ? 'entry' : 'entries'}
            </span>
            <span className="text-sm font-bold text-white">
              {todaySummary.totalLogged.toFixed(1)}h logged
            </span>
          </div>
        </div>
      ) : (
        /* Nothing logged yet */
        <div className="text-center py-4 space-y-2">
          <p className="text-neutral text-sm">Nothing logged yet today</p>
          <p className="text-xs text-neutral/50">
            Start tracking to build your streak
          </p>
        </div>
      )}
    </div>
  );
}