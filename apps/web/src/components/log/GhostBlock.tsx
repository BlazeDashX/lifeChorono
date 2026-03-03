'use client';
// FILE: apps/web/src/components/log/GhostBlock.tsx
// Ghost entries pre-populated from schedule templates.
// Confidence scoring drives visual weight — no explicit numbers shown.
// Interactions: Confirm, Adjust time, Dismiss.

import { useState } from 'react';
import { Check, X, Pencil, Zap, Waves, Moon, Minus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const CAT = {
  productive:  { color: '#10B981', Icon: Zap   },
  leisure:     { color: '#F59E0B', Icon: Waves },
  restoration: { color: '#06B6D4', Icon: Moon  },
  neutral:     { color: '#64748B', Icon: Minus },
} as const;
type Cat = keyof typeof CAT;

// confidence -> visual weight
// 1.00 solid border, 75% opacity  — this is your routine
// 0.85 dashed, 55% opacity        — usually happens
// 0.70 dashed, 40% opacity        — varies
// 0.50 dotted, 28% opacity        — uncertain nudge
function gs(conf: number) {
  if (conf >= 0.9)  return { bs:'solid',  op:0.75, to:0.65, ba:'40' };
  if (conf >= 0.75) return { bs:'dashed', op:0.55, to:0.50, ba:'30' };
  if (conf >= 0.6)  return { bs:'dashed', op:0.40, to:0.38, ba:'22' };
  return                   { bs:'dotted', op:0.28, to:0.28, ba:'16' };
}

export interface Ghost {
  id: string; title: string; category: string;
  startTime: string; endTime: string;
  confidence: number; status: string;
}

export default function GhostBlock({
  ghost, dateStr, onDone,
}: {
  ghost: Ghost; dateStr: string; onDone: () => void;
}) {
  const qc = useQueryClient();
  const [hov, setHov]             = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd]     = useState('');

  const c  = CAT[ghost.category as Cat] ?? CAT.neutral;
  const st = gs(ghost.confidence);
  const { Icon } = c;

  const sd = new Date(ghost.startTime);
  const ed = new Date(ghost.endTime);
  const top = sd.getUTCHours() * 60 + sd.getUTCMinutes();
  const h   = Math.max(Math.round((ed.getTime() - sd.getTime()) / 60000), 32);
  const fmt = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['ghosts',  dateStr] });
    qc.invalidateQueries({ queryKey: ['entries', dateStr] });
    onDone();
  };

  const { mutate: confirm, isPending } = useMutation({
    mutationFn: (body: any) =>
      api.post(`/schedule-templates/ghosts/${ghost.id}/confirm`, body).then(r => r.data),
    onSuccess: inv,
  });
  const { mutate: dismiss } = useMutation({
    mutationFn: () =>
      api.post(`/schedule-templates/ghosts/${ghost.id}/dismiss`, {}).then(r => r.data),
    onSuccess: inv,
  });

  const doConfirm = () => {
    confirm(
      editing
        ? { startTime:`${dateStr}T${editStart}:00.000Z`, endTime:`${dateStr}T${editEnd}:00.000Z` }
        : {}
    );
    setEditing(false);
  };

  if (ghost.status !== 'PENDING') return null;

  return (
    <div
      className="absolute"
      style={{ top:`${top}px`, height:`${h}px`, left:0, right:0, zIndex:1 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setEditing(false); }}
    >
      <div
        className="relative h-full rounded-xl overflow-hidden select-none transition-opacity duration-200"
        style={{
          opacity:      hov ? Math.min(st.op + 0.2, 1) : st.op,
          borderTop:    `1px ${st.bs} ${c.color}${st.ba}`,
          borderRight:  `1px ${st.bs} ${c.color}${st.ba}`,
          borderBottom: `1px ${st.bs} ${c.color}${st.ba}`,
          borderLeft:   `2px ${st.bs} ${c.color}`,
          backgroundImage:
            `repeating-linear-gradient(45deg,${c.color}07 0,${c.color}07 1px,transparent 1px,transparent 9px)`,
        }}
      >
        <div className={`relative px-3 h-full flex flex-col ${h < 48 ? 'justify-center' : 'py-2 justify-between'}`}>
          {/* Title row */}
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-3 h-3 shrink-0" style={{ color:c.color, opacity:st.to+0.1 }} />
            <p className={`font-medium truncate ${h < 48 ? 'text-xs' : 'text-sm'}`}
              style={{ color:c.color, opacity:st.to }}>
              {ghost.title}
            </p>
            {/* Silent low-confidence dot */}
            {ghost.confidence < 0.85 && (
              <div className="w-1 h-1 rounded-full shrink-0 ml-auto"
                style={{ backgroundColor:c.color, opacity:0.22 }} />
            )}
          </div>

          {/* Time */}
          {h >= 48 && !editing && (
            <p className="text-xs font-mono" style={{ color:c.color, opacity:st.to * 0.8 }}>
              {fmt(sd)} – {fmt(ed)}
            </p>
          )}

          {/* Inline time adjustment */}
          {editing && (
            <div className="flex items-center gap-1 mt-1">
              <input type="time" value={editStart} onChange={e=>setEditStart(e.target.value)}
                className="rounded-md px-1.5 py-0.5 text-xs focus:outline-none"
                style={{ width:'72px', backgroundColor:'#06060E', border:`1px solid ${c.color}35`, color:'#F1F0FF', colorScheme:'dark' }}
                onClick={e=>e.stopPropagation()} />
              <span style={{ color:c.color, opacity:0.4, fontSize:'10px' }}>–</span>
              <input type="time" value={editEnd} onChange={e=>setEditEnd(e.target.value)}
                className="rounded-md px-1.5 py-0.5 text-xs focus:outline-none"
                style={{ width:'72px', backgroundColor:'#06060E', border:`1px solid ${c.color}35`, color:'#F1F0FF', colorScheme:'dark' }}
                onClick={e=>e.stopPropagation()} />
            </div>
          )}
        </div>

        {/* Action buttons */}
        {hov && (
          <div className="absolute top-1 right-1 flex gap-0.5">
            <button onClick={e=>{e.stopPropagation();doConfirm();}} disabled={isPending}
              title={editing ? 'Confirm with adjusted time' : 'Confirm'}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
              style={{ backgroundColor:`${c.color}25`, color:c.color }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.backgroundColor=`${c.color}45`)}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.backgroundColor=`${c.color}25`)}>
              <Check className="w-3 h-3" />
            </button>
            {!editing && (
              <button
                onClick={e=>{e.stopPropagation();setEditStart(fmt(sd));setEditEnd(fmt(ed));setEditing(true);}}
                title="Adjust time"
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
                style={{ backgroundColor:'rgba(255,255,255,0.04)', color:'#4A4A6A' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#4A4A6A')}>
                <Pencil className="w-3 h-3" />
              </button>
            )}
            <button onClick={e=>{e.stopPropagation();dismiss();}} title="Not today"
              className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
              style={{ backgroundColor:'rgba(255,255,255,0.04)', color:'#4A4A6A' }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#f87171')}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#4A4A6A')}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}