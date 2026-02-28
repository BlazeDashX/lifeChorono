'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMoodLog, useTodayMoodSummary } from '@/hooks/useMoodLog';
import { useToast } from '@/lib/toast';
import { type MoodScore } from '@/lib/moodQuotes';

const MOOD_OPTIONS: { value: MoodScore; emoji: string; label: string }[] = [
  { value: 1, emoji: '😔', label: 'Very low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const AUTO_DISMISS_SECONDS = 10;

interface MoodModalProps {
  open?: boolean;
  onClose?: () => void;
}

function isTodaySummaryObject(v: unknown): v is { count?: number } {
  return typeof v === 'object' && v !== null;
}

export function MoodModal({ open, onClose }: MoodModalProps) {
  const { data: todaySummaryRaw, isLoading, isFetched } = useTodayMoodSummary();
  const { mutate, isPending } = useMoodLog();
  const { toast } = useToast();

  // Normalize weird responses: '' -> null
  const todaySummary = typeof todaySummaryRaw === 'string' ? null : todaySummaryRaw;

  const [visible, setVisible] = useState(false);
  const [selectedScore, setSelectedScore] = useState<MoodScore | null>(null);
  const [note, setNote] = useState('');
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECONDS);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoShown = useRef(false);

  // ✅ AUTO OPEN (THIS WAS MISSING IN YOUR CURRENT FILE)
  useEffect(() => {
    if (!isFetched || isLoading) return;

    const noMoodToday =
      todaySummary === null ||
      todaySummary === undefined ||
      (isTodaySummaryObject(todaySummary) && (todaySummary.count ?? 0) === 0);

    if (noMoodToday && !hasAutoShown.current) {
      hasAutoShown.current = true;
      setVisible(true);
    }
  }, [isFetched, isLoading, todaySummary]);

  // Optional debug
  useEffect(() => {
    console.log('[MoodModal state]', {
      isFetched,
      isLoading,
      todaySummary,
      visible,
      open,
    });
  }, [isFetched, isLoading, todaySummary, visible, open]);

  // Controlled open from MoodBanner ("Log again")
  useEffect(() => {
    if (open) {
      setSelectedScore(null);
      setNote('');
      setVisible(true);
    }
  }, [open]);

  // Countdown only for auto-show (i.e., when no mood today)
  useEffect(() => {
    if (!visible) return;
    if (todaySummary) return; // if user already has mood today, no auto-dismiss

    startCountdown();
    return () => clearCountdown();
  }, [visible, todaySummary]);

  function startCountdown() {
    clearCountdown();
    setCountdown(AUTO_DISMISS_SECONDS);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown();
          close();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function close() {
    clearCountdown();
    setVisible(false);
    setSelectedScore(null);
    setNote('');
    onClose?.();
  }

  function handleScoreSelect(score: MoodScore) {
    setSelectedScore(score);
    if (!todaySummary) startCountdown();
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNote(e.target.value);
    if (!todaySummary) startCountdown();
  }

  function handleSubmit() {
    if (selectedScore === null) return;
    clearCountdown();

    mutate(
      { score: selectedScore, note: note.trim() || undefined },
      {
        onSuccess: () => {
          close();
          toast('Mood logged. Your daily average has been updated.', 'success');
        },
        onError: () => {
          toast('Could not save. Please try again.', 'error');
        },
      }
    );
  }

  if (!visible) return null;

  const isReopen = !!todaySummary;
  const logCount =
    isTodaySummaryObject(todaySummary) ? (todaySummary.count ?? 0) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div
        className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-2xl p-6 space-y-5 shadow-2xl"
          style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
        >
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-base font-semibold" style={{ color: '#E2E2F0' }}>
              {isReopen ? 'Log another mood' : 'How are you feeling today?'}
            </h2>
            <p className="text-xs" style={{ color: '#4A4A6A' }}>
              {isReopen
                ? `You've logged ${logCount} time${logCount !== 1 ? 's' : ''} today. Your daily average updates each time.`
                : 'Takes 5 seconds. Helps your weekly insights.'}
            </p>
          </div>

          {/* Emoji picker */}
          <div className="flex justify-between gap-2">
            {MOOD_OPTIONS.map((option) => {
              const isSelected = selectedScore === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={option.label}
                  onClick={() => handleScoreSelect(option.value)}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-2.5 px-1
                             transition-all duration-150 focus:outline-none
                             focus-visible:ring-2 focus-visible:ring-purple-500"
                  style={{
                    border: isSelected
                      ? '1px solid #7C3AED'
                      : '1px solid #1A1A2E',
                    backgroundColor: isSelected
                      ? 'rgba(124,58,237,0.15)'
                      : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span
                    className="text-2xl transition-transform duration-150"
                    style={{
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {option.emoji}
                  </span>
                  <span
                    className="text-[10px] font-medium leading-none"
                    style={{ color: isSelected ? '#A78BFA' : '#4A4A6A' }}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional note */}
          <textarea
            value={note}
            onChange={handleNoteChange}
            placeholder="Optional note..."
            maxLength={500}
            rows={2}
            aria-label="Optional note"
            className="w-full resize-none rounded-xl px-3 py-2.5 text-sm
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                       placeholder:text-[#4A4A6A] transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid #1A1A2E',
              color: '#E2E2F0',
            }}
          />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: '#4A4A6A' }}
            >
              {isReopen ? 'Cancel' : 'Skip'}
              {!isReopen && (
                <span
                  className="inline-flex items-center justify-center rounded-full
                             text-[10px] font-bold w-4 h-4"
                  style={{ backgroundColor: '#1A1A2E', color: '#4A4A6A' }}
                >
                  {countdown}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedScore === null || isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold
                         transition-all duration-150 focus:outline-none
                         focus-visible:ring-2 focus-visible:ring-purple-500
                         disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: selectedScore ? '#7C3AED' : '#1A1A2E',
                color: selectedScore ? '#FFFFFF' : '#4A4A6A',
              }}
            >
              {isPending ? 'Saving...' : 'Log mood'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}