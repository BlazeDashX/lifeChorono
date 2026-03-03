'use client';
// FILE: apps/web/src/components/log/CatchupBanner.tsx
//
// "Fill yesterday" banner — shown on today's log when yesterday has sparse coverage.
// Fires only when:
//   • yesterday has active template ≥ 180 min
//   • user had some activity but < 50% coverage
//   • user hasn't already dismissed it today (persisted server-side)
//
// Dismissal is persisted via POST /routine/catchup/dismiss — won't reappear all day.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowRight, X } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface CatchupBannerProps {
    // The "yesterday" date string (YYYY-MM-DD) this banner is about
    forDate: string;
    coveragePct: number;
    coveredMinutes: number;
    expectedMinutes: number;
}

export default function CatchupBanner({
    forDate, coveragePct, coveredMinutes, expectedMinutes,
}: CatchupBannerProps) {
    const router = useRouter();
    const qc = useQueryClient();
    const [gone, setGone] = useState(false);

    const { mutate: dismiss, isPending } = useMutation({
        mutationFn: () => api.post('/routine/catchup/dismiss', { forDate }).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['catchup', forDate] });
            setGone(true);
        },
    });

    const handleFill = () => {
        // Navigate to yesterday's log — ghosts will still be showing (Day 1 catchup)
        router.push(`/log?date=${forDate}`);
    };

    if (gone) return null;

    // Human-readable yesterday label
    const yesterday = new Date(forDate + 'T12:00:00.000Z'); // noon UTC avoids tz edge cases
    const dayLabel = format(yesterday, 'EEEE'); // e.g. "Tuesday"

    // Coverage bar width
    const pct = Math.min(coveragePct, 100);

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-all"
            style={{
                backgroundColor: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.18)',
            }}
        >
            {/* Coverage mini-bar */}
            <div className="shrink-0 flex flex-col items-center gap-1" style={{ width: '28px' }}>
                <div className="w-full rounded-full overflow-hidden" style={{ height: '3px', backgroundColor: 'rgba(245,158,11,0.15)' }}>
                    <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: '#F59E0B' }}
                    />
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: '#F59E0B', opacity: 0.7, fontSize: '10px' }}>
                    {pct}%
                </span>
            </div>

            {/* Message */}
            <p className="flex-1 text-xs leading-relaxed" style={{ color: '#9896B8' }}>
                {dayLabel} looks light — your usual schedule is still there to confirm.
            </p>

            {/* Fill button */}
            <button
                onClick={handleFill}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all"
                style={{
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    color: '#F59E0B',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245,158,11,0.22)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245,158,11,0.12)')}
            >
                Fill in
                <ArrowRight className="w-3 h-3" />
            </button>

            {/* Dismiss — persisted, won't return today */}
            <button
                onClick={() => dismiss()}
                disabled={isPending}
                className="shrink-0 transition-colors"
                style={{ color: '#2A2A42' }}
                title="Dismiss for today"
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9896B8')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2A2A42')}
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}