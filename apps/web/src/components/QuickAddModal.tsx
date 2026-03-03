'use client';

// FILE: apps/web/src/components/QuickAddModal.tsx

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntry } from '@/lib/api-entries';
import { format } from 'date-fns';
import { X, Check, Zap, Waves, Moon, Minus } from 'lucide-react';
import { useToast } from '@/lib/toast';

const CATS = {
  productive:  { color:'#10B981', glow:'rgba(16,185,129,0.25)',  activeBg:'rgba(16,185,129,0.12)', label:'Productive',  Icon:Zap   },
  leisure:     { color:'#F59E0B', glow:'rgba(245,158,11,0.25)',  activeBg:'rgba(245,158,11,0.12)', label:'Leisure',     Icon:Waves },
  restoration: { color:'#06B6D4', glow:'rgba(6,182,212,0.25)',   activeBg:'rgba(6,182,212,0.12)',  label:'Restoration', Icon:Moon  },
  neutral:     { color:'#64748B', glow:'rgba(100,116,139,0.2)',  activeBg:'rgba(100,116,139,0.1)', label:'Neutral',     Icon:Minus },
} as const;
type Cat = keyof typeof CATS;

export default function QuickAddModal({ isOpen, onClose, selectedDate, prefillData }: {
  isOpen:boolean; onClose:()=>void; selectedDate:Date; prefillData?:any;
}) {
  const qc      = useQueryClient();
  const { toast } = useToast();
  const ds      = format(selectedDate,'yyyy-MM-dd');
  const titleRef = useRef<HTMLInputElement>(null);

  const [title,    setTitle]    = useState('');
  const [cat,      setCat]      = useState<Cat|null>(null);
  const [start,    setStart]    = useState('09:00');
  const [end,      setEnd]      = useState('10:00');
  const [note,     setNote]     = useState('');
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (prefillData) {
      setTitle(prefillData.title||'');
      setCat(prefillData.category||null);
    } else {
      const n = new Date(), h = n.getHours(), m = n.getMinutes()>=30?30:0;
      setStart(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`);
      setEnd(`${((m===30?(h+1):h)%24).toString().padStart(2,'0')}:${m===30?'00':'30'}`);
      setTitle(''); setCat(null); setNote(''); setShowNote(false);
    }
    setTimeout(()=>titleRef.current?.focus(),80);
  }, [isOpen, prefillData]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e:KeyboardEvent) => {
      if (e.key==='Escape') handleClose();
      if ((e.metaKey||e.ctrlKey)&&e.key==='Enter') handleSubmit();
    };
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  });

  const { mutate, isPending } = useMutation({
    mutationFn: createEntry,
    onMutate: async newEntry => {
      await qc.cancelQueries({queryKey:['entries',ds]});
      const prev = qc.getQueryData(['entries',ds]);
      qc.setQueryData(['entries',ds],(old:any)=>[...(old||[]),{...newEntry,id:'temp-'+Date.now(),durationMinutes:60}]);
      return { prev };
    },
    onError: (_,__,ctx) => { qc.setQueryData(['entries',ds],ctx?.prev); toast('Could not add entry.','error'); },
    onSettled: () => { qc.invalidateQueries({queryKey:['entries',ds]}); qc.invalidateQueries({queryKey:['dashboard']}); },
    onSuccess: () => { toast('Added to your day.','success'); handleClose(); },
  });

  const handleClose = () => {
    onClose();
    setTimeout(()=>{ setTitle(''); setCat(null); setNote(''); setShowNote(false); },200);
  };
  const handleSubmit = () => {
    if (!title.trim()||!cat) return;
    mutate({ title:title.trim(), category:cat, startTime:`${ds}T${start}:00.000Z`, endTime:`${ds}T${end}:00.000Z`, note:note.trim()||undefined, ...(prefillData?.id&&{recurringTaskId:prefillData.id}) });
  };

  if (!isOpen) return null;

  const ac     = cat ? CATS[cat] : null;
  const canSave = !!title.trim() && !!cat;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ backgroundColor:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }} onClick={handleClose} />

      {/* Modal — always centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{
            maxWidth:'420px',
            backgroundColor:'#080812',
            borderTop:`1px solid ${ac?ac.color+'30':'#16162A'}`,
            borderLeft:`1px solid ${ac?ac.color+'18':'#16162A'}`,
            borderRight:`1px solid ${ac?ac.color+'18':'#16162A'}`,
            borderBottom:`1px solid ${ac?ac.color+'18':'#16162A'}`,
            boxShadow: ac
              ? `0 0 60px ${ac.glow}, 0 32px 80px rgba(0,0,0,0.7)`
              : '0 32px 80px rgba(0,0,0,0.7)',
            transition:'border-color 0.25s,box-shadow 0.25s',
          }}
        >
          {/* Color strip */}
          <div className="h-0.5 w-full transition-all duration-300"
            style={{ background:ac?`linear-gradient(90deg,transparent,${ac.color}70,transparent)`:'transparent' }} />

          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color:'#3A3A58' }}>
                What did this time become?
              </span>
              <button onClick={handleClose} className="p-1 rounded-lg transition-colors" style={{ color:'#3A3A58' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#3A3A58')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e=>setTitle(e.target.value)}
              placeholder="Name this time..."
              className="w-full bg-transparent text-xl font-semibold focus:outline-none placeholder:font-normal"
              style={{ color:'#F1F0FF', caretColor:ac?.color??'#7C3AED' }}
            />

            {/* Category pills */}
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(CATS) as [Cat, typeof CATS[Cat]][]).map(([key,cfg]) => {
                const { Icon } = cfg;
                const active = cat===key;
                return (
                  <button key={key} onClick={()=>setCat(active?null:key)}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl text-xs font-medium transition-all duration-200"
                    style={{
                      backgroundColor: active ? cfg.activeBg : '#0E0E1C',
                      borderTop:    `1px solid ${active?cfg.color+'50':'#1A1A2E'}`,
                      borderLeft:   `1px solid ${active?cfg.color+'50':'#1A1A2E'}`,
                      borderRight:  `1px solid ${active?cfg.color+'50':'#1A1A2E'}`,
                      borderBottom: `1px solid ${active?cfg.color+'50':'#1A1A2E'}`,
                      color:    active ? cfg.color : '#4A4A6A',
                      boxShadow: active ? `0 0 16px ${cfg.glow}` : 'none',
                      transform: active ? 'scale(1.04)' : 'scale(1)',
                    }}>
                    <Icon className="w-4 h-4" />
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Start */}
              <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor:'#0E0E1C', border:'1px solid #1A1A2E' }}>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color:'#3A3A58' }}>Start</p>
                <input type="time" value={start} onChange={e=>setStart(e.target.value)}
                  className="w-full bg-transparent focus:outline-none font-mono font-bold text-lg"
                  style={{ color:'#F1F0FF', colorScheme:'dark' }} />
              </div>
              {/* End */}
              <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor:'#0E0E1C', border:'1px solid #1A1A2E' }}>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color:'#3A3A58' }}>End</p>
                <input type="time" value={end} onChange={e=>setEnd(e.target.value)}
                  className="w-full bg-transparent focus:outline-none font-mono font-bold text-lg"
                  style={{ color:'#F1F0FF', colorScheme:'dark' }} />
              </div>
            </div>

            {/* Note */}
            {showNote ? (
              <input autoFocus type="text" value={note} onChange={e=>setNote(e.target.value)}
                placeholder="A note, if it matters..."
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ backgroundColor:'#0E0E1C', border:'1px solid #1A1A2E', color:'#6B6B8A' }}
                onFocus={e=>(e.target.style.borderColor=ac?.color??'#7C3AED')}
                onBlur={e=>(e.target.style.borderColor='#1A1A2E')} />
            ) : (
              <button onClick={()=>setShowNote(true)} className="text-xs transition-colors" style={{ color:'#252538' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#4A4A6A')}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#252538')}>
                + Add a note
              </button>
            )}

            {/* Save button */}
            <button onClick={handleSubmit} disabled={!canSave||isPending}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-250 disabled:opacity-25"
              style={{
                background: ac
                  ? `linear-gradient(135deg,${ac.color},${ac.color}CC)`
                  : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
                color:'#fff',
                boxShadow: canSave&&ac ? `0 0 24px ${ac.glow}` : 'none',
              }}>
              {isPending
                ? <span className="animate-pulse">Recording…</span>
                : <><Check className="w-4 h-4" />Record this time</>}
            </button>

            <p className="text-xs text-center" style={{ color:'#141422' }}>⌘↵ to record</p>
          </div>
        </div>
      </div>
    </>
  );
}