'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { Heart } from 'lucide-react';
import type { CapsuleLetter } from '@/components/capsule/CapsuleLetterView';

// ── Shared rendering (same logic as CapsuleLetterView.LetterBody) ───────────
function LetterBody({ body }: { body: string }) {
  const lines = body.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        if (i === 0 && line.endsWith(',')) {
          return <p key={i} className="text-sm font-semibold" style={{ color: '#F1F0FF' }}>{line}</p>;
        }
        if (line.startsWith('"') && line.endsWith('"')) {
          return (
            <p key={i} className="text-sm leading-relaxed italic pl-3 py-0.5"
              style={{ color: '#C4B5FD', borderLeft: '2px solid rgba(124,58,237,0.4)' }}>
              {line}
            </p>
          );
        }
        if (line.startsWith('— ')) {
          return <p key={i} className="text-xs italic pt-1" style={{ color: '#7C3AED' }}>{line}</p>;
        }
        if (line.startsWith('One question')) {
          return <p key={i} className="text-xs uppercase tracking-wide pt-2" style={{ color: '#4A4A6A' }}>{line}</p>;
        }
        return (
          <p key={i} className="text-sm leading-relaxed" style={{ color: '#9896B8' }}>{line}</p>
        );
      })}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  three_month: '3 Months',
  six_month: '6 Months',
  one_year: '1 Year',
  two_year: '2 Years',
};

// ── Letter card ─────────────────────────────────────────────────────────────
function LetterCard({ letter }: { letter: CapsuleLetter }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/capsule/letters/${id}/read`).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsule'] });
    },
  });

  const handleOpen = () => {
    if (!letter.readAt) markRead(letter.id);
    setExpanded(e => !e);
  };

  const dateLabel = new Date(letter.generatedAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const isUnread = !letter.readAt;

  return (
    <div className="space-y-0">
      {/* Card header — always visible */}
      <div
        className="rounded-xl p-5 cursor-pointer transition-all"
        style={{
          backgroundColor: '#0F0F1A',
          border: `1px solid ${isUnread ? 'rgba(124,58,237,0.45)' : expanded ? 'rgba(124,58,237,0.2)' : '#1A1A2E'}`,
          borderRadius: expanded ? '12px 12px 0 0' : '12px',
        }}
        onClick={handleOpen}
        onMouseEnter={e =>
          ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)')
        }
        onMouseLeave={e =>
        ((e.currentTarget as HTMLElement).style.borderColor =
          isUnread ? 'rgba(124,58,237,0.45)' : expanded ? 'rgba(124,58,237,0.2)' : '#1A1A2E')
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'rgba(124,58,237,0.15)',
                  color: '#A78BFA',
                }}
              >
                {TYPE_LABEL[letter.type] ?? letter.type}
              </span>
              {isUnread && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: 'rgba(124,58,237,0.3)',
                    color: '#C4B5FD',
                  }}
                >
                  Unread
                </span>
              )}
            </div>

            <p
              className="text-sm font-medium leading-snug truncate"
              style={{ color: '#F1F0FF' }}
            >
              {letter.subject}
            </p>

            <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>
              {dateLabel}
            </p>
          </div>

          <span
            className="text-xs shrink-0 mt-1 transition-transform"
            style={{
              color: '#4A4A6A',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}
          >
            →
          </span>
        </div>
      </div>

      {/* Expanded letter body */}
      {expanded && (
        <div
          className="px-6 py-5 space-y-4"
          style={{
            backgroundColor: '#080810',
            border: '1px solid rgba(124,58,237,0.15)',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
          }}
        >
          {/* Thin purple divider */}
          <div className="h-px w-10" style={{ backgroundColor: 'rgba(124,58,237,0.3)' }} />

          <LetterBody body={letter.body} />

          <button
            onClick={() => setExpanded(false)}
            className="text-xs mt-2"
            style={{ color: '#4A4A6A' }}
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ReflectionsPage() {
  const { data: letters = [], isLoading } = useQuery<CapsuleLetter[]>({
    queryKey: ['capsule', 'letters'],
    queryFn: () => api.get('/capsule/letters').then(r => r.data),
  });

  const unread = letters.filter(l => !l.readAt).length;

  return (
    <AppLayout>
      <TopBar />

      <div className="max-w-2xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* Header */}
        <div className="pt-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4" style={{ color: '#7C3AED' }} />
              <h2 className="text-base font-bold" style={{ color: '#F1F0FF' }}>
                Reflections
              </h2>
            </div>
            <p className="text-sm" style={{ color: '#4A4A6A' }}>
              Letters from your river, across time.
            </p>
          </div>

          {unread > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium mt-1"
              style={{
                backgroundColor: 'rgba(124,58,237,0.2)',
                color: '#A78BFA',
                border: '1px solid rgba(124,58,237,0.3)',
              }}
            >
              {unread} unread
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div
                key={i}
                className="h-24 rounded-xl animate-pulse"
                style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && letters.length === 0 && (
          <div
            className="rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-3"
            style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}
            >
              <Heart className="w-4 h-4" style={{ color: '#7C3AED' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#F1F0FF' }}>
              Your first letter is on its way
            </p>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: '#4A4A6A' }}>
              It arrives three months after you started. Your river has been
              watching, and it has things to say.
            </p>
          </div>
        )}

        {/* Letters */}
        <div className="space-y-3">
          {letters.map(letter => (
            <LetterCard key={letter.id} letter={letter} />
          ))}
        </div>

      </div>
    </AppLayout>
  );
}