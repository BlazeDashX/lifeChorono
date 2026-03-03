'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, isToday as checkIsToday } from 'date-fns';
import { fetchDayEntries } from '@/lib/api-entries';
import { api } from '@/lib/api';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Check, X, Zap, Waves, Moon, Minus } from 'lucide-react';
import QuickAddModal from '@/components/QuickAddModal';
import RightPanel from '@/components/log/RightPanel';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { LogSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/lib/toast';

const CAT = {
  productive:  { color: '#10B981', glow: 'rgba(16,185,129,0.3)',  bg: 'rgba(16,185,129,0.08)', tint: 'rgba(16,185,129,0.02)', label: 'Productive',  Icon: Zap   },
  leisure:     { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)',  bg: 'rgba(245,158,11,0.08)', tint: 'rgba(245,158,11,0.02)', label: 'Leisure',     Icon: Waves },
  restoration: { color: '#06B6D4', glow: 'rgba(6,182,212,0.3)',   bg: 'rgba(6,182,212,0.08)',  tint: 'rgba(6,182,212,0.02)', label: 'Restoration', Icon: Moon  },
  neutral:     { color: '#64748B', glow: 'rgba(100,116,139,0.2)', bg: 'rgba(100,116,139,0.06)',tint: 'rgba(100,116,139,0.015)',label: 'Neutral',    Icon: Minus },
} as const;
const CATS = ['productive','leisure','restoration','neutral'] as const;
type Cat = typeof CATS[number];

const toTime   = (iso: string) => { const d = new Date(iso); return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`; };
const toIso    = (date: string, t: string) => `${date}T${t}:00.000Z`;
const fmtDur   = (m: number) => { const h = Math.floor(m/60), r = m%60; return h&&r?`${h}h ${r}m`:h?`${h}h`:`${r}m`; };
const fmtRange = (s: string, e: string) => `${toTime(s)} – ${toTime(e)}`;

function getDominant(entries: any[]): Cat | null {
  if (!entries.length) return null;
  const t = CATS.reduce((a,c) => { a[c] = entries.filter(e=>e.category===c).reduce((s,e)=>s+e.durationMinutes,0); return a; }, {} as any);
  const sorted = (Object.entries(t) as [Cat,number][]).sort((a,b)=>b[1]-a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : null;
}
function getSegment(entries: any[]) {
  if (!entries.length) return 'morning';
  const h = new Date(entries[entries.length-1].endTime).getUTCHours();
  return h<12?'morning':h<17?'afternoon':h<21?'evening':'night';
}
function getShift(entries: any[]): {from:Cat,to:Cat}|null {
  const s = [...entries].sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  for (let i=s.length-1;i>=1;i--) if(s[i].category!==s[i-1].category) return {from:s[i-1].category as Cat, to:s[i].category as Cat};
  return null;
}
function getObservational(entries: any[], isToday: boolean): string {
  if (!entries.length) return isToday ? 'Quiet so far.' : 'Nothing recorded.';
  const dom = getDominant(entries), seg = getSegment(entries), shift = getShift(entries);
  const total = entries.reduce((s,e)=>s+e.durationMinutes,0);
  if (shift && entries.length >= 3) return `Moved from ${CAT[shift.from].label.toLowerCase()} into ${CAT[shift.to].label.toLowerCase()}.`;
  if (!dom || total < 60) return 'Light activity so far.';
  if (dom==='restoration') return seg==='morning'?'A restorative morning.':'Leaning restorative today.';
  if (dom==='productive')  return seg==='morning'?'A focused start.':'Deep in it today.';
  if (dom==='leisure')     return 'A leisurely day.';
  return 'Balanced so far.';
}
function getNarrative(entries: any[], isToday: boolean): string|null {
  if (!entries.length) return null;
  const s = [...entries].sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime());
  const shift = getShift(s), seg = getSegment(s), dom = getDominant(s);
  if (shift) {
    const t = ({morning:'this morning',afternoon:'this afternoon',evening:'this evening',night:'tonight'} as any)[seg];
    return `You moved from ${CAT[shift.from].label.toLowerCase()} into ${CAT[shift.to].label.toLowerCase()} ${t}.`;
  }
  if (!dom) return null;
  if (dom==='restoration') return seg==='morning'?'Your morning leaned restorative.':'The day has been restorative.';
  if (dom==='productive')  return 'Your focus held through the day.';
  if (dom==='leisure')     return 'The day has been easy.';
  return isToday ? 'The day has been quiet so far.' : 'A steady day.';
}

interface ES { title:string; category:Cat; note:string; startTime:string; endTime:string; }

function EditForm({ entry, dateStr, onSave, onCancel, isSaving }: { entry:any; dateStr:string; onSave:(s:ES)=>void; onCancel:()=>void; isSaving:boolean; }) {
  const [f,setF] = useState<ES>({ title:entry.title, category:entry.category, note:entry.note??'', startTime:toTime(entry.startTime), endTime:toTime(entry.endTime) });
  const c = CAT[f.category];
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor:'#0A0A16', borderTop:`1px solid ${c.color}35`, borderRight:`1px solid ${c.color}20`, borderBottom:`1px solid ${c.color}20`, borderLeft:`3px solid ${c.color}`, boxShadow:`0 0 24px ${c.glow}` }}>
      <input autoFocus type="text" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="Entry title"
        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none font-medium"
        style={{ backgroundColor:'#060610', border:'1px solid #1A1A2E', color:'#F1F0FF' }}
        onFocus={e=>(e.target.style.borderColor=c.color)} onBlur={e=>(e.target.style.borderColor='#1A1A2E')} />
      <div className="flex gap-2 flex-wrap">
        <select value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value as Cat}))}
          className="rounded-xl px-3 py-2 text-xs focus:outline-none flex-1" style={{ backgroundColor:'#060610', border:'1px solid #1A1A2E', color:'#F1F0FF' }}>
          {CATS.map(cat=><option key={cat} value={cat}>{CAT[cat].label}</option>)}
        </select>
        <input type="time" value={f.startTime} onChange={e=>setF(p=>({...p,startTime:e.target.value}))}
          className="rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ backgroundColor:'#060610', border:'1px solid #1A1A2E', color:'#F1F0FF', colorScheme:'dark' }} />
        <span className="self-center text-xs" style={{ color:'#2A2A4A' }}>→</span>
        <input type="time" value={f.endTime} onChange={e=>setF(p=>({...p,endTime:e.target.value}))}
          className="rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ backgroundColor:'#060610', border:'1px solid #1A1A2E', color:'#F1F0FF', colorScheme:'dark' }} />
      </div>
      <input type="text" value={f.note} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder="Note (optional)"
        className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ backgroundColor:'#060610', border:'1px solid #1A1A2E', color:'#9896B8' }} />
      <div className="flex gap-2">
        <button onClick={()=>onSave(f)} disabled={isSaving||!f.title.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40" style={{ backgroundColor:c.color, color:'#fff' }}>
          <Check className="w-3 h-3" />{isSaving?'Saving…':'Save'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs" style={{ backgroundColor:'#1A1A2E', color:'#9896B8' }}>
          <X className="w-3 h-3" />Cancel
        </button>
      </div>
    </div>
  );
}

function EntryBlock({ entry, dateStr, isEditing, onEdit, onDelete, onSave, onCancel, isSaving, index }: {
  entry:any; dateStr:string; isEditing:boolean; onEdit:()=>void; onDelete:()=>void;
  onSave:(s:ES)=>void; onCancel:()=>void; isSaving:boolean; index:number;
}) {
  const [hov, setHov] = useState(false);
  const s = new Date(entry.startTime);
  const top = s.getUTCHours()*60 + s.getUTCMinutes();
  const h   = Math.max(entry.durationMinutes, 32);
  const c   = CAT[entry.category as Cat] ?? CAT.neutral;
  const {Icon} = c;
  return (
    <div className="absolute entry-block" style={{ top:`${top}px`, height:`${h}px`, left:0, right:0, zIndex:isEditing?30:2, animationDelay:`${index*40}ms` }}>
      {isEditing ? (
        <div className="absolute z-30" style={{ top:0, left:0, right:0 }}>
          <EditForm entry={entry} dateStr={dateStr} onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
        </div>
      ) : (
        <div className="relative h-full rounded-xl overflow-hidden cursor-default select-none"
          style={{ background:`linear-gradient(135deg,${c.bg} 0%,${c.color}06 100%)`, borderTop:`1px solid ${c.color}25`, borderRight:`1px solid ${c.color}15`, borderBottom:`1px solid ${c.color}15`, borderLeft:`3px solid ${c.color}`, transform:hov?'translateY(-1px)':'translateY(0)', boxShadow:hov?`0 4px 20px ${c.glow},inset 0 0 30px ${c.color}05`:'none', transition:'transform 150ms ease,box-shadow 150ms ease' }}
          onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background:`linear-gradient(90deg,transparent,${c.color}50,transparent)` }} />
          <div className={`relative px-3 h-full flex flex-col ${h<48?'justify-center':'py-2.5 justify-between'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`font-semibold leading-tight ${h<48?'text-xs':'text-sm'}`} style={{ color:'#EAEAFF', maxWidth:'calc(100% - 32px)' }}>{entry.title}</p>
              <div className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor:c.color+'15', opacity:hov?1:0.45, transition:'opacity 150ms' }}>
                <Icon className="w-2.5 h-2.5" style={{ color:c.color }} />
              </div>
            </div>
            {h >= 48 && (
              <div className="flex items-center justify-between mt-auto" style={{ opacity:hov?1:0.55, transition:'opacity 150ms' }}>
                <span className="text-xs font-mono" style={{ color:c.color+'BB' }}>{fmtRange(entry.startTime,entry.endTime)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor:c.color+'18', color:c.color }}>{fmtDur(entry.durationMinutes)}</span>
              </div>
            )}
            {h >= 90 && entry.note && <p className="text-xs italic truncate mt-0.5" style={{ color:'#3A3A5A' }}>{entry.note}</p>}
          </div>
          {hov && (
            <div className="absolute top-1.5 right-1.5 flex gap-0.5">
              <button onClick={e=>{e.stopPropagation();onEdit();}} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor:'rgba(6,6,16,0.88)', color:'#9896B8' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#F1F0FF')} onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}>
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button onClick={e=>{e.stopPropagation();onDelete();}} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor:'rgba(6,6,16,0.88)', color:'#f87171' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(248,113,113,0.18)')} onMouseLeave={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(6,6,16,0.88)')}>
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NowLine() {
  const [m, setM] = useState(0);
  useEffect(() => { const u=()=>{const n=new Date();setM(n.getHours()*60+n.getMinutes());}; u(); const id=setInterval(u,30000); return()=>clearInterval(id); }, []);
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center" style={{ top:`${m}px` }}>
      <div className="relative w-2.5 h-2.5 -ml-1.5 shrink-0 rounded-full" style={{ backgroundColor:'#A78BFA', boxShadow:'0 0 8px rgba(167,139,250,0.9)', animation:'nowBreathe 3s ease-in-out infinite' }} />
      <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,#A78BFA70,transparent 60%)' }} />
    </div>
  );
}

function EmptyCanvas({ isToday }: { isToday:boolean }) {
  return (
    <div className="absolute inset-x-0 top-36 flex flex-col items-center gap-3 text-center pointer-events-none">
      <div className="relative w-14 h-14">
        {[0,1,2].map(i=>(
          <div key={i} className="absolute inset-0 rounded-full"
            style={{ background:`radial-gradient(circle,rgba(124,58,237,${0.1-i*0.025}) 0%,transparent 70%)`, animation:`breathe ${3+i*0.7}s ease-in-out infinite`, animationDelay:`${i*0.4}s` }} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center text-xl">〰️</div>
      </div>
      <p className="text-xs max-w-[180px] leading-relaxed" style={{ color:'#2A2A3A' }}>
        {isToday?'Tap + to begin recording your day.':'Nothing was recorded on this day.'}
      </p>
    </div>
  );
}

export default function LogPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const [date, setDate]       = useState(new Date());
  const [open, setOpen]       = useState(false);
  const [prefill, setPrefill] = useState<any>(null);
  const [editId, setEditId]   = useState<string|null>(null);

  const ds    = format(date,'yyyy-MM-dd');
  const today = checkIsToday(date);

  useEffect(() => {
    if (!ref.current) return;
    if (today) {
      const n = new Date(), off = n.getHours()*60+n.getMinutes();
      setTimeout(() => ref.current?.scrollTo({ top:Math.max(0,off-160), behavior:'smooth' }), 120);
    } else ref.current.scrollTo({ top:0, behavior:'smooth' });
  }, [ds]);

  const { data:entries=[], isLoading } = useQuery({ queryKey:['entries',ds], queryFn:()=>fetchDayEntries(ds) });

  const dom  = useMemo(()=>getDominant(entries as any[]),[entries]);
  const obs  = useMemo(()=>getObservational(entries as any[],today),[entries,today]);
  const narr = useMemo(()=>getNarrative(entries as any[],today),[entries,today]);
  const tint = dom ? CAT[dom].tint : 'transparent';

  const { mutate:upd, isPending:upding } = useMutation({
    mutationFn: ({ id, body }:{ id:string; body:object }) => api.patch(`/entries/${id}`,body).then(r=>r.data),
    onSuccess: () => { qc.invalidateQueries({queryKey:['entries',ds]}); qc.invalidateQueries({queryKey:['dashboard']}); setEditId(null); toast('Entry updated.','success'); },
    onError: (e:any) => toast(e?.response?.data?.message??'Could not save.','error'),
  });
  const { mutate:del } = useMutation({
    mutationFn: (id:string) => api.delete(`/entries/${id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['entries',ds]}); qc.invalidateQueries({queryKey:['dashboard']}); toast('Removed.','success'); },
    onError: () => toast('Could not remove.','error'),
  });

  const save   = (id:string, f:ES) => upd({ id, body:{ title:f.title.trim(), category:f.category, note:f.note.trim()||undefined, startTime:toIso(ds,f.startTime), endTime:toIso(ds,f.endTime) }});
  const remove = (id:string, title:string) => { if (window.confirm(`Remove "${title}"?`)) del(id); };

  if (isLoading) return <AppLayout><TopBar /><LogSkeleton /></AppLayout>;

  return (
    <AppLayout>
      {/* Ambient tint */}
      <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000"
        style={{ background:`radial-gradient(ellipse 60% 40% at 55% 25%,${tint},transparent)` }} />

      <TopBar />

      <div className="relative z-10 flex flex-col" style={{ height:'calc(100vh - 56px)' }}>

        {/* ── ZONE 1: Header ── */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3">
          <div className="relative flex items-center justify-center">
            <button onClick={()=>setDate(subDays(date,1))} className="absolute left-0 p-1.5 rounded-lg transition-colors" style={{ color:'#3A3A5A' }}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#3A3A5A')}>
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <h1 className="text-base font-semibold tracking-tight" style={{ color:'#F1F0FF' }}>
                {today ? `Today — ${format(date,'MMMM d, yyyy')}` : format(date,'MMMM d, yyyy')}
              </h1>
              <p className="text-sm mt-0.5 transition-colors duration-700" style={{ color:dom?CAT[dom].color+'99':'#2E2E4A' }}>
                {obs}
              </p>
            </div>

            <button onClick={()=>{ if(!today) setDate(addDays(date,1)); }} className="absolute right-0 p-1.5 rounded-lg transition-colors"
              style={{ color:today?'transparent':'#3A3A5A', pointerEvents:today?'none':'auto' }}
              onMouseEnter={e=>{ if(!today)(e.currentTarget as HTMLElement).style.color='#9896B8'; }}
              onMouseLeave={e=>{ if(!today)(e.currentTarget as HTMLElement).style.color='#3A3A5A'; }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {!today && (
            <div className="flex justify-center mt-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full" style={{ backgroundColor:'rgba(74,74,106,0.1)', color:'#3A3A5A', border:'1px solid #141428' }}>
                Archived view
              </span>
            </div>
          )}

          <div className="mt-3 h-px" style={{ background:'linear-gradient(90deg,transparent,#141428 20%,#141428 80%,transparent)' }} />
        </div>

        {/* ── Two-column body ── */}
        <div className="flex-1 flex overflow-hidden" style={{ maxWidth:'960px', margin:'0 auto', width:'100%', padding:'0 16px 16px' }}>

          {/* LEFT — Scrollable timeline */}
          <div ref={ref} className="flex-1 overflow-y-auto min-w-0" style={{ scrollbarWidth:'thin', scrollbarColor:'#111120 transparent' }}>
            <div className="relative" style={{ height:'1440px', paddingLeft:'52px', paddingRight:'4px' }}>

              {/* Hour lines + labels */}
              {[...Array(24)].map((_,i) => {
                const is6=i%6===0, is3=i%3===0&&!is6;
                return (
                  <div key={i} className="absolute" style={{ top:`${i*60}px`, left:0, right:0 }}>
                    <span className="absolute font-mono select-none" style={{ left:0, top:'-8px', width:'44px', textAlign:'right', fontSize:'10px', color:is6?'#3A3A5A':is3?'#1E1E32':'#141422' }}>
                      {i.toString().padStart(2,'0')}:00
                    </span>
                    <div style={{ marginLeft:'52px', height:'1px', backgroundColor:is6?'rgba(124,58,237,0.09)':is3?'rgba(26,26,46,0.5)':'rgba(14,14,30,0.8)' }} />
                  </div>
                );
              })}

              {/* Left rail */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left:'52px', width:'1px', backgroundColor:'#0C0C1A' }} />

              {/* Zone labels */}
              {([[0,'midnight'],[6,'morning'],[12,'midday'],[17,'evening'],[22,'night']] as [number,string][]).map(([h,lbl])=>(
                <div key={h} className="absolute pointer-events-none select-none" style={{ top:`${h*60+5}px`, right:'8px' }}>
                  <span className="text-xs italic" style={{ color:'#0E0E1C' }}>{lbl}</span>
                </div>
              ))}

              {today && <NowLine />}
              {!(entries as any[]).length && <EmptyCanvas isToday={today} />}

              {/* ZONE 3 — Entry blocks */}
              <div className="absolute top-0 bottom-0" style={{ left:'56px', right:0 }}>
                {(entries as any[]).map((e,i) => (
                  <EntryBlock key={e.id} entry={e} dateStr={ds}
                    isEditing={editId===e.id} onEdit={()=>setEditId(e.id)}
                    onDelete={()=>remove(e.id,e.title)} onSave={f=>save(e.id,f)}
                    onCancel={()=>setEditId(null)} isSaving={upding} index={i} />
                ))}
              </div>

              {/* ZONE 5 — Narrative */}
              {narr && (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-8 pointer-events-none"
                  style={{ background:'linear-gradient(to bottom,transparent,rgba(6,6,12,0.5))' }}>
                  <p className="text-xs italic text-center" style={{ color:'#252535' }}>{narr}</p>
                </div>
              )}
            </div>
          </div>

          {/* Column divider */}
          <div className="flex-shrink-0 w-px mx-4 self-stretch" style={{ backgroundColor:'#0A0A18' }} />

          {/* RIGHT — Quick-add panel */}
          <div className="flex-shrink-0 overflow-hidden pt-1" style={{ width:'192px' }}>
            <RightPanel
              dateStr={ds}
              onSelect={(task:any) => { setPrefill(task); setOpen(true); }}
            />
          </div>
        </div>

        {/* FAB */}
        <button onClick={()=>{ setPrefill(null); setOpen(true); }}
          className="fixed z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ bottom:'24px', right:'28px', background:'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow:'0 0 20px rgba(124,58,237,0.5),0 0 40px rgba(124,58,237,0.15)' }}
          onMouseEnter={e=>((e.currentTarget as HTMLElement).style.boxShadow='0 0 28px rgba(124,58,237,0.7),0 0 56px rgba(124,58,237,0.25)')}
          onMouseLeave={e=>((e.currentTarget as HTMLElement).style.boxShadow='0 0 20px rgba(124,58,237,0.5),0 0 40px rgba(124,58,237,0.15)')}>
          <Plus className="text-white w-5 h-5" />
        </button>
      </div>

      <QuickAddModal isOpen={open} onClose={()=>{ setOpen(false); setPrefill(null); }} selectedDate={date} prefillData={prefill} />

      <style>{`
        .entry-block { animation: entryIn 0.22s ease-out both; }
        @keyframes entryIn { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
        @keyframes breathe { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.2);opacity:1} }
        @keyframes nowBreathe { 0%,100%{opacity:0.7;box-shadow:0 0 6px rgba(167,139,250,0.8)} 50%{opacity:1;box-shadow:0 0 12px rgba(167,139,250,1)} }
      `}</style>
    </AppLayout>
  );
}