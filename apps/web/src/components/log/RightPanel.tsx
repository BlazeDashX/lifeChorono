'use client';

// FILE: apps/web/src/components/log/RightPanel.tsx
// Right panel beside the timeline.
// Shows: due-today suggestions → your regulars → time-aware presets
// "Manage regulars" scrolls to Settings#regulars

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Settings, ChevronRight, Zap, Waves, Moon, Minus } from 'lucide-react';
import Link from 'next/link';

const CAT = {
  productive:  { color: '#10B981', bg: 'rgba(16,185,129,0.08)',  glow: 'rgba(16,185,129,0.2)',  Icon: Zap   },
  leisure:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  glow: 'rgba(245,158,11,0.2)',  Icon: Waves },
  restoration: { color: '#06B6D4', bg: 'rgba(6,182,212,0.08)',   glow: 'rgba(6,182,212,0.2)',   Icon: Moon  },
  neutral:     { color: '#64748B', bg: 'rgba(100,116,139,0.06)', glow: 'rgba(100,116,139,0.15)',Icon: Minus },
} as const;
type Cat = keyof typeof CAT;

const fmtDur = (m: number) => {
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
};

const TIME_PRESETS = () => {
  const h = new Date().getHours();
  if (h < 10) return [
    { title: 'Morning routine',  category: 'restoration' as Cat, defaultDuration: 30  },
    { title: 'Deep work',        category: 'productive'  as Cat, defaultDuration: 90  },
    { title: 'Breakfast',        category: 'restoration' as Cat, defaultDuration: 20  },
    { title: 'Exercise',         category: 'restoration' as Cat, defaultDuration: 45  },
  ];
  if (h < 14) return [
    { title: 'Deep work',        category: 'productive'  as Cat, defaultDuration: 90  },
    { title: 'Lunch break',      category: 'restoration' as Cat, defaultDuration: 45  },
    { title: 'Email & messages', category: 'neutral'     as Cat, defaultDuration: 30  },
    { title: 'Meeting',          category: 'productive'  as Cat, defaultDuration: 60  },
  ];
  if (h < 18) return [
    { title: 'Afternoon focus',  category: 'productive'  as Cat, defaultDuration: 60  },
    { title: 'Walk outside',     category: 'restoration' as Cat, defaultDuration: 30  },
    { title: 'Admin',            category: 'neutral'     as Cat, defaultDuration: 30  },
    { title: 'Reading',          category: 'leisure'     as Cat, defaultDuration: 45  },
  ];
  return [
    { title: 'Dinner',           category: 'restoration' as Cat, defaultDuration: 45  },
    { title: 'Wind down',        category: 'leisure'     as Cat, defaultDuration: 60  },
    { title: 'Reading',          category: 'leisure'     as Cat, defaultDuration: 45  },
    { title: 'Sleep',            category: 'restoration' as Cat, defaultDuration: 480 },
  ];
};

// ── Single chip ───────────────────────────────────────────────────────────────
function Chip({ task, onSelect, badge }: {
  task: any; onSelect: (t: any) => void; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  const c = CAT[task.category as Cat] ?? CAT.neutral;

  return (
    <button
      onClick={() => onSelect(task)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
      style={{
        backgroundColor: hov ? c.bg : '#0A0A16',
        borderTop:    `1px solid ${hov ? c.color + '30' : '#111120'}`,
        borderLeft:   `1px solid ${hov ? c.color + '30' : '#111120'}`,
        borderRight:  `1px solid ${hov ? c.color + '30' : '#111120'}`,
        borderBottom: `1px solid ${hov ? c.color + '30' : '#111120'}`,
        transform:    hov ? 'translateX(2px)' : 'translateX(0)',
        boxShadow:    hov ? `0 0 12px ${c.glow}` : 'none',
      }}
    >
      {/* Category dot */}
      <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: c.color }} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight" style={{ color: '#C8C8E8' }}>
          {task.title}
        </p>
        {task.defaultDuration && (
          <p className="text-xs mt-0.5" style={{ color: '#2A2A42' }}>
            {fmtDur(task.defaultDuration)}
          </p>
        )}
      </div>

      {/* Badge or plus */}
      {badge
        ? <span className="text-xs px-1.5 py-0.5 rounded-md shrink-0 font-medium"
            style={{ backgroundColor: c.color + '18', color: c.color }}>{badge}</span>
        : <Plus className="w-3 h-3 shrink-0 transition-opacity duration-150"
            style={{ color: c.color, opacity: hov ? 0.85 : 0.25 }} />
      }
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function Section({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-2 px-1">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#282840' }}>
        {label}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#181828' }}>{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RightPanel({
  dateStr, onSelect,
}: {
  dateStr: string; onSelect: (task: any) => void;
}) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', dateStr],
    queryFn: () => api.get(`/recurring/suggestions?date=${dateStr}`).then(r => r.data),
    staleTime: 60_000,
  });

  const { data: regulars = [] } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.get('/recurring').then(r => r.data),
    staleTime: 60_000,
  });

  const active      = (regulars as any[]).filter(r => r.isActive);
  const suggIds     = new Set((suggestions as any[]).map((s: any) => s.id));
  const others      = active.filter(r => !suggIds.has(r.id));
  const hasRegulars = (suggestions as any[]).length > 0 || active.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none', gap: '20px' }}>

      {/* Due today */}
      {(suggestions as any[]).length > 0 && (
        <div>
          <Section label="Due today" sub="Not yet logged" />
          <div className="space-y-1.5">
            {(suggestions as any[]).map((t: any) => (
              <Chip key={t.id} task={t} onSelect={onSelect} badge="due" />
            ))}
          </div>
        </div>
      )}

      {/* Other regulars */}
      {others.length > 0 && (
        <div>
          <Section label="Regulars" />
          <div className="space-y-1.5">
            {others.map((t: any) => (
              <Chip key={t.id} task={t} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Presets — only when no regulars yet */}
      {!hasRegulars && (
        <div>
          <Section label="Quick add" sub="Common entries" />
          <div className="space-y-1.5">
            {TIME_PRESETS().map((p, i) => (
              <Chip key={i} task={p} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Footer: manage link */}
      <div className="mt-auto pt-3" style={{ borderTop: '1px solid #0A0A16' }}>
        <Link href="/settings#regulars">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
            style={{ color: '#1E1E32' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = '#6B6B8A';
              el.style.backgroundColor = '#0E0E1C';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = '#1E1E32';
              el.style.backgroundColor = 'transparent';
            }}
          >
            <Settings className="w-3 h-3" />
            <span>Manage regulars</span>
            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
          </div>
        </Link>
      </div>
    </div>
  );
}