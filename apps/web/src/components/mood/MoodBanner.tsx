'use client';

import { useState } from 'react';
import { useTodayMoodSummary } from '@/hooks/useMoodLog';
import { MOOD_DATA, getDailyQuote, type MoodScore } from '@/lib/moodQuotes';
import { MoodModal } from './MoodModal';

export function MoodBanner() {
  const { data: todaySummary, isLoading } = useTodayMoodSummary();
  const [modalOpen, setModalOpen] = useState(false);

  // Skeleton
  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-4 animate-pulse"
        style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
      >
        <div className="w-10 h-10 rounded-full bg-[#1A1A2E] shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-3/4 rounded bg-[#1A1A2E]" />
          <div className="h-3 w-1/2 rounded bg-[#1A1A2E]" />
        </div>
      </div>
    );
  }

  // Not logged yet — soft prompt, no urgency
  if (!todaySummary) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
      >
        <span className="text-2xl">🌤️</span>
        <p className="text-sm italic flex-1" style={{ color: '#4A4A6A' }}>
          Log your mood to see a quote matched to your day.
        </p>
      </div>
    );
  }

  const score = todaySummary.roundedScore as MoodScore;
  const meta = MOOD_DATA[score];
  const quote = getDailyQuote(score);
  const { avgScore, count } = todaySummary;

  return (
    <>
      {/* Reopen modal — controlled */}
      <MoodModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <div
        className="rounded-xl p-4 flex items-start gap-4"
        style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
      >
        {/* Emoji — based on averaged score */}
        <span className="text-3xl leading-none shrink-0 mt-0.5">
          {meta.emoji}
        </span>

        {/* Quote + subline */}
        <div className="space-y-1 min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug"
            style={{ color: '#E2E2F0' }}
          >
            &ldquo;{quote}&rdquo;
          </p>
          <p className="text-xs" style={{ color: '#4A4A6A' }}>
            {meta.subline}
          </p>

          {/* Avg score + count + log again */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs" style={{ color: '#4A4A6A' }}>
              Avg today:&nbsp;
              <span style={{ color: '#9896B8' }}>
                {avgScore.toFixed(1)} / 5
              </span>
              &nbsp;·&nbsp;
              {count} log{count !== 1 ? 's' : ''}
            </span>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-xs transition-colors ml-auto"
              style={{ color: '#7C3AED' }}
            >
              + Log again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}