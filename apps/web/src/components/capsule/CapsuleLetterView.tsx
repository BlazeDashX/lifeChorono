'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: apps/web/src/components/capsule/CapsuleLetterView.tsx
//
// Full-screen letter reading experience.
// Auto-shows when an unread letter exists. Add to dashboard/page.tsx inside
// a CardErrorBoundary.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X, Heart } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
export interface CapsuleLetter {
  id:          string;
  type:        'three_month' | 'six_month' | 'one_year' | 'two_year';
  subject:     string;
  body:        string;
  moodArc:     string | null;
  generatedAt: string;
  readAt:      string | null;
}

const TYPE_LABEL: Record<CapsuleLetter['type'], string> = {
  three_month: 'Three months in the river',
  six_month:   'Six months in the river',
  one_year:    'One year in the river',
  two_year:    'Two years in the river',
};

// ── Hook ───────────────────────────────────────────────────────────────────
export function useUnreadCapsule() {
  return useQuery<CapsuleLetter | null>({
    queryKey: ['capsule', 'unread'],
    queryFn:  () =>
      api.get('/capsule/unread').then(r => r.data ?? null),
    staleTime: 1000 * 60 * 10, // recheck every 10 min
  });
}

// ── Letter body renderer ───────────────────────────────────────────────────
// Splits on newlines, applies styled rendering per line type.
function LetterBody({ body }: { body: string }) {
  const lines = body.split('\n');

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        // Salutation — "Name,"
        if (i === 0 && line.endsWith(',')) {
          return (
            <p key={i} className="text-base font-semibold" style={{ color: '#F1F0FF' }}>
              {line}
            </p>
          );
        }

        // Quoted text — user's own sealed words
        if (line.startsWith('"') && line.endsWith('"')) {
          return (
            <p
              key={i}
              className="text-sm leading-relaxed italic pl-4 py-1"
              style={{
                color:      '#C4B5FD',
                borderLeft: '2px solid rgba(124,58,237,0.5)',
              }}
            >
              {line}
            </p>
          );
        }

        // Sign-off
        if (line.startsWith('— ')) {
          return (
            <p key={i} className="text-sm italic pt-2" style={{ color: '#7C3AED' }}>
              {line}
            </p>
          );
        }

        // Transition markers ("On [date], you wrote this:" etc.)
        if (
          line.startsWith('On ') ||
          line.startsWith('You also wrote') ||
          line.startsWith('Here is what') ||
          line.startsWith('Only you know')
        ) {
          return (
            <p key={i} className="text-xs uppercase tracking-wide pt-2" style={{ color: '#4A4A6A' }}>
              {line}
            </p>
          );
        }

        // Question label
        if (line.startsWith('One question')) {
          return (
            <p key={i} className="text-xs uppercase tracking-wide pt-3" style={{ color: '#4A4A6A' }}>
              {line}
            </p>
          );
        }

        // Default body
        return (
          <p key={i} className="text-sm leading-relaxed" style={{ color: '#9896B8' }}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

// ── Main overlay component ─────────────────────────────────────────────────
export function CapsuleLetterView() {
  const queryClient = useQueryClient();
  const { data: letter, isLoading } = useUnreadCapsule();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (letter) setOpen(true);
  }, [letter?.id]); // only trigger when a new letter id appears

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/capsule/letters/${id}/read`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsule'] });
    },
  });

  if (isLoading || !letter || !open) return null;

  const handleClose = () => {
    markRead(letter.id);
    setOpen(false);
  };

  const dateLabel = new Date(letter.generatedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    // ── Backdrop ────────────────────────────────────────────────────────
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
    >
      {/* ── Letter card ── */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{
          backgroundColor: '#080810',
          border:           '1px solid rgba(124,58,237,0.25)',
          boxShadow:        '0 0 80px rgba(124,58,237,0.12)',
        }}
      >
        {/* Top strip — type label */}
        <div
          className="flex items-center justify-between px-7 pt-6 pb-0"
        >
          <div className="flex items-center gap-2">
            <Heart className="w-3 h-3" style={{ color: '#7C3AED' }} />
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: '#7C3AED' }}
            >
              {TYPE_LABEL[letter.type]}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg -mr-1 transition-colors"
            style={{ color: '#4A4A6A' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9896B8')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4A4A6A')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subject + date */}
        <div className="px-7 pt-4 pb-0">
          <p
            className="text-base font-semibold leading-snug"
            style={{ color: '#F1F0FF' }}
          >
            {letter.subject}
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#4A4A6A' }}>
            {dateLabel}
          </p>
        </div>

        {/* Divider */}
        <div className="px-7 pt-5 pb-0">
          <div
            className="h-px w-12"
            style={{ backgroundColor: 'rgba(124,58,237,0.35)' }}
          />
        </div>

        {/* Letter body */}
        <div className="px-7 py-6">
          <LetterBody body={letter.body} />
        </div>

        {/* Footer */}
        <div
          className="px-7 pb-6 pt-3 flex items-center justify-between"
          style={{ borderTop: '1px solid #0F0F1A' }}
        >
          <p className="text-xs" style={{ color: '#2A2A4A' }}>
            Saved to your Reflections.
          </p>

          <button
            onClick={handleClose}
            className="text-xs px-4 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: 'rgba(124,58,237,0.12)',
              border:          '1px solid rgba(124,58,237,0.25)',
              color:           '#A78BFA',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.22)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.12)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}