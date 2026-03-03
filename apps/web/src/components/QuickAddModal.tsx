'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: apps/web/src/components/QuickAddModal.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntry } from '@/lib/api-entries';
import { format } from 'date-fns';
import { X, Check } from 'lucide-react';

// ── Category config ───────────────────────────────────────────────────────────
const CAT_CONFIG = {
  productive:  { color: '#10B981', glow: 'rgba(16,185,129,0.3)',  bg: 'rgba(16,185,129,0.12)', label: 'Productive',  emoji: '⚡' },
  leisure:     { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)',  bg: 'rgba(245,158,11,0.12)', label: 'Leisure',     emoji: '🌊' },
  restoration: { color: '#06B6D4', glow: 'rgba(6,182,212,0.3)',   bg: 'rgba(6,182,212,0.12)',  label: 'Restoration', emoji: '🌙' },
  neutral:     { color: '#64748B', glow: 'rgba(100,116,139,0.25)', bg: 'rgba(100,116,139,0.1)', label: 'Neutral',    emoji: '〰️' },
} as const;

type Category = keyof typeof CAT_CONFIG;

export default function QuickAddModal({
  isOpen,
  onClose,
  selectedDate,
  prefillData,
}: {
  isOpen:       boolean;
  onClose:      () => void;
  selectedDate: Date;
  prefillData?: any;
}) {
  const queryClient = useQueryClient();
  const dateStr     = format(selectedDate, 'yyyy-MM-dd');
  const titleRef    = useRef<HTMLInputElement>(null);

  const [title,     setTitle]     = useState('');
  const [category,  setCategory]  = useState<Category | null>(null);
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd,   setTimeEnd]   = useState('10:00');
  const [note,      setNote]      = useState('');
  const [showNote,  setShowNote]  = useState(false);

  // ── Populate from prefill ─────────────────────────────────────────────────
  useEffect(() => {
    const pad    = (n: number) => String(n).padStart(2, '0');

    // Compute NOW snapped to nearest 15 min — used only for today
    const now    = new Date();
    const snap   = Math.round(now.getMinutes() / 15) * 15;
    const snapH  = snap === 60 ? now.getHours() + 1 : now.getHours();
    const snapM  = snap === 60 ? 0 : snap;
    const nowStr = `${pad(snapH % 24)}:${pad(snapM)}`;

    if (prefillData) {
      // Past-date FAB — times come pre-baked from log page (last entry end time)
      if (prefillData.__pastDefault) {
        const sd = new Date(prefillData.startTime);
        const ed = new Date(prefillData.endTime);
        setTimeStart(`${pad(sd.getUTCHours())}:${pad(sd.getUTCMinutes())}`);
        setTimeEnd(`${pad(ed.getUTCHours())}:${pad(ed.getUTCMinutes())}`);
        setTitle('');
        setCategory(null);
        setNote('');
        setShowNote(false);
        return;
      }

      setTitle(prefillData.title || '');
      setCategory(prefillData.category || null);

      if (prefillData.startTime && prefillData.endTime) {
        // Ghost / template prefill with exact times
        const sd = new Date(prefillData.startTime);
        const ed = new Date(prefillData.endTime);
        setTimeStart(`${pad(sd.getUTCHours())}:${pad(sd.getUTCMinutes())}`);
        setTimeEnd(`${pad(ed.getUTCHours())}:${pad(ed.getUTCMinutes())}`);
      } else if (prefillData.defaultDuration) {
        // Regular/preset chip — start = NOW (snapped), end = now + duration
        const startMins = snapH * 60 + snapM;
        const endMins   = startMins + prefillData.defaultDuration;
        const endH      = Math.floor(endMins / 60) % 24;
        const endM      = endMins % 60;
        setTimeStart(nowStr);
        setTimeEnd(`${pad(endH)}:${pad(endM)}`);
      }
    } else {
      // FAB on today — start = now, end = now + 1h
      const endH = (snapH + 1) % 24;
      setTimeStart(nowStr);
      setTimeEnd(`${pad(endH)}:${pad(snapM)}`);
      setTitle('');
      setCategory(null);
      setNote('');
      setShowNote(false);
    }
  }, [prefillData, isOpen]);

  // Focus title on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const { mutate, isPending } = useMutation({
    mutationFn: createEntry,
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['entries', dateStr] });
      const prev = queryClient.getQueryData(['entries', dateStr]);
      queryClient.setQueryData(['entries', dateStr], (old: any) => [
        ...(old || []),
        { ...newEntry, id: 'temp-' + Date.now(), durationMinutes: 60 },
      ]);
      return { prev };
    },
    onError: (_err, _entry, context) => {
      queryClient.setQueryData(['entries', dateStr], context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleClose();
    },
  });

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTitle(''); setCategory(null);
      setNote(''); setShowNote(false);
    }, 200);
  };

  const handleSubmit = () => {
    if (!title.trim() || !category) return;
    mutate({
      title: title.trim(),
      category,
      startTime: `${dateStr}T${timeStart}:00.000Z`,
      endTime:   `${dateStr}T${timeEnd}:00.000Z`,
      note:      note.trim() || undefined,
      ...(prefillData?.id && { recurringTaskId: prefillData.id }),
    });
  };

  // ── Keyboard submit ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, title, category, timeStart, timeEnd, note]);

  if (!isOpen) return null;

  const activeCat = category ? CAT_CONFIG[category] : null;
  const canSave   = !!title.trim() && !!category;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 w-full max-w-md transition-all duration-200"
        style={{
          bottom:    '0',
          left:      '50%',
          transform: 'translateX(-50%)',
          padding:   '0 0 env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="rounded-t-2xl md:rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#0A0A14',
            border:          `1px solid ${activeCat ? activeCat.color + '30' : '#1A1A2E'}`,
            borderBottom:    'none',
            boxShadow:       activeCat
              ? `0 -8px 40px ${activeCat.glow}, 0 0 0 1px ${activeCat.color}15`
              : '0 -8px 40px rgba(0,0,0,0.4)',
            transition:      'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          {/* Glow strip at top — shifts color with category */}
          <div
            className="h-0.5 w-full transition-all duration-300"
            style={{
              background: activeCat
                ? `linear-gradient(90deg, transparent, ${activeCat.color}, transparent)`
                : 'transparent',
            }}
          />

          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: '#4A4A6A' }}>
                Log time
              </p>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#4A4A6A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#F1F0FF')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4A4A6A')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title input */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What are you logging?"
              className="w-full bg-transparent text-base font-medium
                         focus:outline-none placeholder:italic"
              style={{
                color:             '#F1F0FF',
                borderTop:         'none',
                borderLeft:        'none',
                borderRight:       'none',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: activeCat ? activeCat.color + '40' : '#1A1A2E',
                paddingBottom:     '10px',
                transition:        'border-color 0.3s',
              }}
            />

            {/* Category pills */}
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(CAT_CONFIG) as [Category, typeof CAT_CONFIG[Category]][]).map(([key, cfg]) => {
                const isActive = category === key;
                return (
                  <button
                    key={key}
                    onClick={() => setCategory(isActive ? null : key)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl
                               text-xs font-medium transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? cfg.bg : 'rgba(255,255,255,0.03)',
                      border:          `1px solid ${isActive ? cfg.color + '50' : '#1A1A2E'}`,
                      color:           isActive ? cfg.color : '#4A4A6A',
                      boxShadow:       isActive ? `0 0 12px ${cfg.glow}` : 'none',
                      transform:       isActive ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <span className="text-base">{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Time pickers */}
            <div
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
            >
              <div className="flex-1 space-y-1">
                <p className="text-xs" style={{ color: '#4A4A6A' }}>Start</p>
                <input
                  type="time"
                  value={timeStart}
                  onChange={e => setTimeStart(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium focus:outline-none"
                  style={{ color: '#F1F0FF' }}
                />
              </div>

              <div
                className="w-6 h-px"
                style={{
                  background: activeCat
                    ? `linear-gradient(90deg, ${activeCat.color}60, ${activeCat.color}60)`
                    : '#2A2A4A',
                }}
              />

              <div className="flex-1 space-y-1">
                <p className="text-xs" style={{ color: '#4A4A6A' }}>End</p>
                <input
                  type="time"
                  value={timeEnd}
                  onChange={e => setTimeEnd(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium focus:outline-none"
                  style={{ color: '#F1F0FF' }}
                />
              </div>
            </div>

            {/* Note — expandable */}
            {showNote ? (
              <input
                autoFocus
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note…"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: '#0F0F1A',
                  border:          '1px solid #1A1A2E',
                  color:           '#9896B8',
                }}
                onFocus={e => (e.target.style.borderColor = activeCat?.color ?? '#7C3AED')}
                onBlur={e  => (e.target.style.borderColor = '#1A1A2E')}
              />
            ) : (
              <button
                onClick={() => setShowNote(true)}
                className="text-xs transition-colors"
                style={{ color: '#4A4A6A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9896B8')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4A4A6A')}
              >
                + Add note
              </button>
            )}

            {/* Save button */}
            <button
              onClick={handleSubmit}
              disabled={!canSave || isPending}
              className="w-full py-3 rounded-xl font-semibold text-sm
                         flex items-center justify-center gap-2
                         transition-all duration-300 disabled:opacity-30"
              style={{
                background:  activeCat
                  ? `linear-gradient(135deg, ${activeCat.color}, ${activeCat.color}CC)`
                  : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                color:       '#fff',
                boxShadow:   canSave && activeCat
                  ? `0 0 20px ${activeCat.glow}`
                  : 'none',
              }}
            >
              {isPending ? (
                <span className="animate-pulse">Saving…</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save entry
                </>
              )}
            </button>

            {/* Keyboard hint */}
            <p className="text-xs text-center" style={{ color: '#2A2A4A' }}>
              ⌘↵ to save quickly
            </p>
          </div>
        </div>
      </div>
    </>
  );
}