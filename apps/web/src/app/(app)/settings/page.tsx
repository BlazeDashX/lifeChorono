'use client';

// FILE: apps/web/src/app/(app)/settings/page.tsx
// Adds "Your Regulars" section — full CRUD for recurring tasks
// wired to existing /recurring backend endpoints.

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import Link from 'next/link';
import {
  Save, Info, Heart, Plus, Trash2, Pencil, Check, X,
  Zap, Waves, Moon, Minus, ToggleLeft, ToggleRight, Calendar, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeeklyGoals { productive:number; leisure:number; restoration:number; neutral:number; }
interface User { id:string; email:string; name:string; weeklyGoals:WeeklyGoals; }
interface RecurringTask {
  id:              string;
  title:           string;
  category:        Cat;
  defaultDuration: number;
  daysOfWeek:      number[];
  isActive:        boolean;
}

const CAT_CFG = {
  productive:  { label:'Productive',  color:'#10B981', bg:'rgba(16,185,129,0.1)',  Icon:Zap   },
  leisure:     { label:'Leisure',     color:'#F59E0B', bg:'rgba(245,158,11,0.1)',  Icon:Waves },
  restoration: { label:'Restoration', color:'#06B6D4', bg:'rgba(6,182,212,0.1)',   Icon:Moon  },
  neutral:     { label:'Neutral',     color:'#64748B', bg:'rgba(100,116,139,0.08)',Icon:Minus },
} as const;
type Cat = keyof typeof CAT_CFG;
const CATS = Object.keys(CAT_CFG) as Cat[];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CARD = { backgroundColor:'#0F0F1A', border:'1px solid #141428' };
const TOTAL = 168;
const fmtDur = (m:number) => { const h=Math.floor(m/60),r=m%60; return h&&r?`${h}h ${r}m`:h?`${h}h`:`${r}m`; };

// ── Recurring task form ───────────────────────────────────────────────────────
interface TaskFormData { title:string; category:Cat; defaultDuration:number; daysOfWeek:number[]; }

function TaskForm({
  initial, onSave, onCancel, isSaving,
}: {
  initial?: Partial<TaskFormData>;
  onSave: (d:TaskFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TaskFormData>({
    title:           initial?.title           ?? '',
    category:        initial?.category        ?? 'productive',
    defaultDuration: initial?.defaultDuration ?? 60,
    daysOfWeek:      initial?.daysOfWeek      ?? [1,2,3,4,5],
  });

  const toggleDay = (d:number) =>
    setForm(p => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(d)
        ? p.daysOfWeek.filter(x=>x!==d)
        : [...p.daysOfWeek,d].sort(),
    }));

  const c = CAT_CFG[form.category];

  return (
    <div className="rounded-2xl p-4 space-y-4"
      style={{ backgroundColor:'#0A0A18', borderTop:`1px solid ${c.color}30`, borderLeft:`2px solid ${c.color}`, borderRight:`1px solid ${c.color}18`, borderBottom:`1px solid ${c.color}18` }}>

      {/* Title */}
      <input autoFocus type="text" value={form.title}
        onChange={e=>setForm(p=>({...p,title:e.target.value}))}
        placeholder="Task name"
        className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
        style={{ backgroundColor:'#060612', border:'1px solid #1A1A2E', color:'#F1F0FF' }}
        onFocus={e=>(e.target.style.borderColor=c.color)}
        onBlur={e=>(e.target.style.borderColor='#1A1A2E')}
      />

      {/* Category pills */}
      <div className="grid grid-cols-4 gap-2">
        {CATS.map(cat => {
          const cfg = CAT_CFG[cat];
          const {Icon} = cfg;
          const active = form.category === cat;
          return (
            <button key={cat} onClick={()=>setForm(p=>({...p,category:cat}))}
              className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150"
              style={{
                backgroundColor: active ? cfg.bg : '#0C0C1A',
                borderTop:`1px solid ${active?cfg.color+'45':'#111120'}`,
                borderLeft:`1px solid ${active?cfg.color+'45':'#111120'}`,
                borderRight:`1px solid ${active?cfg.color+'45':'#111120'}`,
                borderBottom:`1px solid ${active?cfg.color+'45':'#111120'}`,
                color: active ? cfg.color : '#3A3A5A',
                transform: active ? 'scale(1.03)' : 'scale(1)',
              }}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Duration + days row */}
      <div className="flex gap-3 flex-wrap">
        {/* Duration */}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor:'#0C0C1A', border:'1px solid #111120' }}>
          <span className="text-xs" style={{ color:'#4A4A6A' }}>Duration</span>
          <select value={form.defaultDuration} onChange={e=>setForm(p=>({...p,defaultDuration:Number(e.target.value)}))}
            className="bg-transparent text-xs focus:outline-none font-medium" style={{ color:'#F1F0FF' }}>
            {[15,20,30,45,60,90,120,180,240,360,480].map(m=>(
              <option key={m} value={m}>{fmtDur(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Days of week */}
      <div>
        <p className="text-xs mb-2 px-0.5" style={{ color:'#2E2E4A' }}>Repeat on</p>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((d,i) => {
            const active = form.daysOfWeek.includes(i);
            return (
              <button key={i} onClick={()=>toggleDay(i)}
                className="w-9 h-9 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  backgroundColor: active ? c.color+'18' : '#0C0C1A',
                  borderTop:`1px solid ${active?c.color+'40':'#111120'}`,
                  borderLeft:`1px solid ${active?c.color+'40':'#111120'}`,
                  borderRight:`1px solid ${active?c.color+'40':'#111120'}`,
                  borderBottom:`1px solid ${active?c.color+'40':'#111120'}`,
                  color: active ? c.color : '#2A2A42',
                }}>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={()=>onSave(form)} disabled={isSaving||!form.title.trim()||!form.daysOfWeek.length}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all"
          style={{ backgroundColor:c.color, color:'#fff' }}>
          <Check className="w-3 h-3"/>{isSaving?'Saving…':'Save task'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all"
          style={{ backgroundColor:'#141428', color:'#9896B8' }}>
          <X className="w-3 h-3"/>Cancel
        </button>
      </div>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onEdit, onDelete, onToggle }: {
  task:RecurringTask; onEdit:()=>void; onDelete:()=>void; onToggle:()=>void;
}) {
  const [hov, setHov] = useState(false);
  const c = CAT_CFG[task.category] ?? CAT_CFG.neutral;
  const {Icon} = c;
  const days = task.daysOfWeek.map(d=>DAYS[d]).join(', ');

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
      style={{
        backgroundColor: hov ? '#0E0E1C' : 'transparent',
        borderTop:`1px solid ${hov?'#141428':'transparent'}`,
        borderLeft:`1px solid ${hov?'#141428':'transparent'}`,
        borderRight:`1px solid ${hov?'#141428':'transparent'}`,
        borderBottom:`1px solid ${hov?'#141428':'transparent'}`,
        opacity: task.isActive ? 1 : 0.45,
      }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
    >
      {/* Color bar */}
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor:c.color+(task.isActive?'':'50') }}/>

      {/* Icon */}
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor:c.color+'15' }}>
        <Icon className="w-3.5 h-3.5" style={{ color:c.color }}/>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color:'#E8E8F8' }}>{task.title}</p>
        <p className="text-xs mt-0.5" style={{ color:'#3A3A5A' }}>
          {fmtDur(task.defaultDuration)} · {days || 'No days set'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onToggle} className="p-1.5 rounded-lg transition-colors"
          style={{ color:task.isActive?c.color:'#3A3A5A' }}
          title={task.isActive?'Deactivate':'Activate'}>
          {task.isActive
            ? <ToggleRight className="w-4 h-4"/>
            : <ToggleLeft  className="w-4 h-4"/>
          }
        </button>
        {hov && <>
          <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors" style={{ color:'#4A4A6A' }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#4A4A6A')}>
            <Pencil className="w-3.5 h-3.5"/>
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg transition-colors" style={{ color:'#4A4A6A' }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#f87171')}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#4A4A6A')}>
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const regularsRef = useRef<HTMLDivElement>(null);

  // Scroll to #regulars if hash present
  useEffect(() => {
    if (window.location.hash === '#regulars') {
      setTimeout(() => regularsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 200);
    }
  }, []);

  // ── User + goals ──────────────────────────────────────────────────────────
  const { data:user, isLoading:userLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn:  () => api.get('/users/me').then(r=>r.data),
  });

  const [goals, setGoals] = useState<WeeklyGoals>({ productive:40, leisure:28, restoration:56, neutral:20 });
  const [goalsError, setGoalsError] = useState('');

  useEffect(() => {
    if (user?.weeklyGoals && Object.keys(user.weeklyGoals).length) {
      setGoals(user.weeklyGoals as WeeklyGoals);
    }
  }, [user]);

  const total     = Object.values(goals).reduce((a,b)=>a+b,0);
  const remaining = TOTAL - total;
  const isOver    = total > TOTAL;

  const { mutate:saveGoals, isPending:savingGoals } = useMutation({
    mutationFn: () => api.patch('/users/goals', goals).then(r=>r.data),
    onSuccess: () => { qc.invalidateQueries({queryKey:['me']}); qc.invalidateQueries({queryKey:['dashboard']}); toast('Goals saved.'); setGoalsError(''); },
    onError: (e:any) => { const msg=e?.response?.data?.message||'Failed to save'; setGoalsError(msg); toast(msg,'error'); },
  });

  // ── Recurring tasks ───────────────────────────────────────────────────────
  const { data:tasks=[], isLoading:tasksLoading } = useQuery<RecurringTask[]>({
    queryKey: ['recurring'],
    queryFn:  () => api.get('/recurring').then(r=>r.data),
  });

  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState<RecurringTask|null>(null);

  const { mutate:createTask, isPending:creating } = useMutation({
    mutationFn: (d:TaskFormData) => api.post('/recurring', d).then(r=>r.data),
    onSuccess: () => { qc.invalidateQueries({queryKey:['recurring']}); setShowForm(false); toast('Task added.'); },
    onError: () => toast('Could not add task.','error'),
  });

  const { mutate:updateTask, isPending:updating } = useMutation({
    mutationFn: ({id,data}:{id:string;data:Partial<TaskFormData & {isActive:boolean}>}) => api.patch(`/recurring/${id}`,data).then(r=>r.data),
    onSuccess: () => { qc.invalidateQueries({queryKey:['recurring']}); setEditTask(null); toast('Task updated.'); },
    onError: () => toast('Could not update.','error'),
  });

  const { mutate:deleteTask } = useMutation({
    mutationFn: (id:string) => api.delete(`/recurring/${id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['recurring']}); toast('Task removed.'); },
    onError: () => toast('Could not remove.','error'),
  });

  if (userLoading) return <AppLayout><TopBar/><div className="p-8 animate-pulse" style={{color:'#9896B8'}}>Loading…</div></AppLayout>;

  return (
    <AppLayout>
      <TopBar/>

      <div className="max-w-xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* ── Profile ── */}
        <div className="p-6 rounded-xl space-y-4" style={CARD}>
          <h2 className="text-base font-bold" style={{ color:'#F1F0FF' }}>Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
              style={{ backgroundColor:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.3)', color:'#7C3AED' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium" style={{ color:'#F1F0FF' }}>{user?.name}</p>
              <p className="text-sm"     style={{ color:'#9896B8' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* ── Your Routine ── */}
        <Link href="/routine"
          className="flex items-center gap-4 p-5 rounded-xl transition-all group"
          style={CARD}
          onMouseEnter={e=>((e.currentTarget as HTMLElement).style.borderColor='rgba(124,58,237,0.3)')}
          onMouseLeave={e=>((e.currentTarget as HTMLElement).style.borderColor='#141428')}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.2)' }}>
            <Calendar className="w-5 h-5" style={{ color:'#A78BFA' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color:'#F1F0FF' }}>Your Routine</p>
            <p className="text-xs mt-0.5" style={{ color:'#4A4A6A' }}>
              Schedule templates · ghost entries · auto-fill your day
            </p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color:'#3A3A5A' }}/>
        </Link>

        {/* ── Your Regulars ── */}
        <div ref={regularsRef} id="regulars" className="p-6 rounded-xl space-y-4" style={CARD}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color:'#F1F0FF' }}>Your Regulars</h2>
              <p className="text-sm mt-0.5" style={{ color:'#9896B8' }}>
                Tasks you log often. Appear as quick-add chips on your log page.
              </p>
            </div>
            {!showForm && !editTask && (
              <button onClick={()=>setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.3)', color:'#A78BFA' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(124,58,237,0.25)')}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(124,58,237,0.15)')}>
                <Plus className="w-3 h-3"/>Add task
              </button>
            )}
          </div>

          {/* Add form */}
          {showForm && (
            <TaskForm
              onSave={d=>createTask(d)}
              onCancel={()=>setShowForm(false)}
              isSaving={creating}
            />
          )}

          {/* Task list */}
          {tasksLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i=>(
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor:'#0C0C1A' }}/>
              ))}
            </div>
          ) : tasks.length === 0 && !showForm ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color:'#2A2A42' }}>No regular tasks yet.</p>
              <p className="text-xs mt-1" style={{ color:'#1A1A2E' }}>Add tasks you do most days — they'll appear on your log page for quick access.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tasks.map(task => (
                editTask?.id === task.id ? (
                  <TaskForm
                    key={task.id}
                    initial={editTask}
                    onSave={d=>updateTask({id:task.id,data:d})}
                    onCancel={()=>setEditTask(null)}
                    isSaving={updating}
                  />
                ) : (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onEdit={()=>{ setShowForm(false); setEditTask(task); }}
                    onDelete={()=>{ if(window.confirm(`Remove "${task.title}"?`)) deleteTask(task.id); }}
                    onToggle={()=>updateTask({id:task.id,data:{isActive:!task.isActive}})}
                  />
                )
              ))}
            </div>
          )}

          {tasks.length > 0 && !showForm && !editTask && (
            <p className="text-xs pt-1" style={{ color:'#1A1A2E' }}>
              Active tasks appear on your log page. Toggle to show or hide.
            </p>
          )}
        </div>

        {/* ── Weekly Goals ── */}
        <div className="p-6 rounded-xl space-y-5" style={CARD}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color:'#F1F0FF' }}>Weekly Goals</h2>
              <p className="text-sm mt-0.5" style={{ color:'#9896B8' }}>Set target hours per category</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg"
              style={{ backgroundColor:'#14142A', color:'#9896B8', border:'1px solid #1A1A2E' }}>
              <Info className="w-3.5 h-3.5"/>168 hrs/week
            </div>
          </div>

          <div className="space-y-4">
            {CATS.map(cat => {
              const cfg = CAT_CFG[cat];
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:cfg.color }}/>
                    <span className="text-sm" style={{ color:'#F1F0FF' }}>{cfg.label}</span>
                  </div>
                  <input type="number" min={0} max={168} value={goals[cat]}
                    onChange={e=>setGoals(p=>({...p,[cat]:Math.max(0,parseInt(e.target.value)||0)}))}
                    className="w-20 rounded-lg px-3 py-2 text-sm text-center focus:outline-none"
                    style={{ backgroundColor:'#14142A', border:'1px solid #1A1A2E', color:'#F1F0FF' }}
                    onFocus={e=>(e.target.style.borderColor='#7C3AED')}
                    onBlur={e=>(e.target.style.borderColor='#1A1A2E')}
                  />
                  <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor:'#1A1A2E' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width:`${Math.min((goals[cat]/TOTAL)*100,100)}%`, backgroundColor:cfg.color }}/>
                  </div>
                  <span className="text-xs w-8 text-right shrink-0" style={{ color:'#9896B8' }}>{goals[cat]}h</span>
                </div>
              );
            })}
          </div>

          {/* Total bar */}
          <div className="space-y-2 pt-3" style={{ borderTop:'1px solid #1A1A2E' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color:'#9896B8' }}>Total allocated</span>
              <span className="font-bold" style={{ color:isOver?'#f87171':'#F1F0FF' }}>{total}h / 168h</span>
            </div>
            <div className="w-full rounded-full h-2.5 flex overflow-hidden" style={{ backgroundColor:'#1A1A2E' }}>
              {CATS.map(cat=>(
                <div key={cat} className="h-full transition-all"
                  style={{ width:`${Math.min((goals[cat]/TOTAL)*100,100)}%`, backgroundColor:CAT_CFG[cat].color }}/>
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color:remaining<0?'#f87171':'#9896B8' }}>
                {remaining>=0?`${remaining}h unallocated`:`${Math.abs(remaining)}h over limit`}
              </span>
              <span style={{ color:'#4A4A6A' }}>Max 168h/week</span>
            </div>
          </div>

          {goalsError && (
            <div className="text-sm px-3 py-2 rounded-lg"
              style={{ color:'#f87171', backgroundColor:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)' }}>
              {goalsError}
            </div>
          )}

          <button onClick={()=>!isOver&&saveGoals()} disabled={savingGoals||isOver}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            style={{ backgroundColor:isOver?'#14142A':'#7C3AED', color:isOver?'#9896B8':'#fff', cursor:isOver?'not-allowed':'pointer' }}>
            <Save className="w-4 h-4"/>{savingGoals?'Saving…':'Save Goals'}
          </button>
        </div>

        {/* ── Support ── */}
        <div className="p-5 rounded-xl space-y-3" style={CARD}>
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" style={{ color:'#7C3AED' }}/>
            <h2 className="text-sm font-bold" style={{ color:'#F1F0FF' }}>Support & Wellbeing</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color:'#9896B8' }}>
            LifeChrono is a self-awareness companion — not a therapy service, crisis service, or medical device.
            If you are going through a difficult time, please reach out to a professional or someone you trust.
          </p>
          <div className="space-y-2 pt-1">
            {[
              { href:'https://findahelpline.com', label:'Find a crisis helpline in your country' },
              { href:'https://www.befrienders.org', label:'Befrienders Worldwide — emotional support' },
            ].map(({href,label})=>(
              <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs transition-all"
                style={{ backgroundColor:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', color:'#A78BFA' }}
                onMouseEnter={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(124,58,237,0.15)')}
                onMouseLeave={e=>((e.currentTarget as HTMLElement).style.backgroundColor='rgba(124,58,237,0.08)')}>
                <span>{label}</span><span style={{ color:'#4A4A6A' }}>↗</span>
              </a>
            ))}
          </div>
          <p className="text-xs pt-1" style={{ color:'#4A4A6A' }}>Your data in LifeChrono is private and belongs only to you.</p>
        </div>

      </div>
    </AppLayout>
  );
}