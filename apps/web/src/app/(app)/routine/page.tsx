'use client';
// FILE: apps/web/src/app/(app)/routine/page.tsx
// Schedule Templates — define your day skeleton.
// Ghost entries are auto-generated each morning from these templates.
// Confidence scoring + exception memory built into backend.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { useToast } from '@/lib/toast';
import {
    Plus, Trash2, Pencil, Check, X, Zap, Waves, Moon, Minus,
    ChevronDown, ChevronUp, Calendar, Clock, Sparkles, GripVertical,
} from 'lucide-react';

// ── Config ─────────────────────────────────────────────────────────────────────
const CAT = {
    productive: { label: 'Productive', color: '#10B981', bg: 'rgba(16,185,129,0.1)', Icon: Zap },
    leisure: { label: 'Leisure', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', Icon: Waves },
    restoration: { label: 'Restoration', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)', Icon: Moon },
    neutral: { label: 'Neutral', color: '#64748B', bg: 'rgba(100,116,139,0.08)', Icon: Minus },
} as const;
type Cat = keyof typeof CAT;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULLDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = [0, 15, 30, 45];
const CARD = { backgroundColor: '#0F0F1A', border: '1px solid #141428' };

const fmtTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const fmtDur = (sh: number, sm: number, eh: number, em: number) => {
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return '—';
    const h = Math.floor(mins / 60), r = mins % 60;
    return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface BlockForm { title: string; category: Cat; startHour: number; startMinute: number; endHour: number; endMinute: number; }
interface TemplateBlock extends BlockForm { id: string; order: number; editCounts: any; adjustedTimes: any; }
interface Template { id: string; name: string; daysOfWeek: number[]; isActive: boolean; blocks: TemplateBlock[]; }

// ── BlockForm component ────────────────────────────────────────────────────────
function BlockEditor({
    initial, onSave, onCancel, isSaving,
}: {
    initial?: Partial<BlockForm>;
    onSave: (d: BlockForm) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [f, setF] = useState<BlockForm>({
        title: initial?.title ?? '',
        category: initial?.category ?? 'productive',
        startHour: initial?.startHour ?? 9,
        startMinute: initial?.startMinute ?? 0,
        endHour: initial?.endHour ?? 17,
        endMinute: initial?.endMinute ?? 0,
    });
    const c = CAT[f.category];
    const durLabel = fmtDur(f.startHour, f.startMinute, f.endHour, f.endMinute);

    return (
        <div className="rounded-2xl p-4 space-y-4"
            style={{ backgroundColor: '#0A0A18', borderLeft: `2px solid ${c.color}`, borderTop: `1px solid ${c.color}30`, borderRight: `1px solid ${c.color}18`, borderBottom: `1px solid ${c.color}18` }}>

            {/* Title */}
            <input autoFocus type="text" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
                placeholder="What do you do? e.g. Deep work, Gym, Sleep…"
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
                style={{ backgroundColor: '#06060E', border: '1px solid #1A1A2E', color: '#F1F0FF' }}
                onFocus={e => (e.target.style.borderColor = c.color)} onBlur={e => (e.target.style.borderColor = '#1A1A2E')} />

            {/* Category */}
            <div className="grid grid-cols-4 gap-2">
                {(Object.keys(CAT) as Cat[]).map(cat => {
                    const cfg = CAT[cat]; const { Icon } = cfg; const active = f.category === cat;
                    return (
                        <button key={cat} onClick={() => setF(p => ({ ...p, category: cat }))}
                            className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all"
                            style={{ backgroundColor: active ? cfg.bg : '#0C0C1A', border: `1px solid ${active ? cfg.color + '45' : '#111120'}`, color: active ? cfg.color : '#3A3A5A', transform: active ? 'scale(1.03)' : 'scale(1)' }}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{cfg.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Time range */}
            <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                    <p className="text-xs px-0.5" style={{ color: '#3A3A5A' }}>Start</p>
                    <div className="flex gap-1.5">
                        <select value={f.startHour} onChange={e => setF(p => ({ ...p, startHour: +e.target.value }))}
                            className="flex-1 rounded-xl px-2 py-2 text-sm focus:outline-none text-center"
                            style={{ backgroundColor: '#0C0C1A', border: '1px solid #111120', color: '#F1F0FF' }}>
                            {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                        </select>
                        <select value={f.startMinute} onChange={e => setF(p => ({ ...p, startMinute: +e.target.value }))}
                            className="flex-1 rounded-xl px-2 py-2 text-sm focus:outline-none text-center"
                            style={{ backgroundColor: '#0C0C1A', border: '1px solid #111120', color: '#F1F0FF' }}>
                            {MINS.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                        </select>
                    </div>
                </div>

                <div className="pt-5 text-sm" style={{ color: '#2A2A4A' }}>→</div>

                <div className="flex-1 space-y-1">
                    <p className="text-xs px-0.5" style={{ color: '#3A3A5A' }}>End</p>
                    <div className="flex gap-1.5">
                        <select value={f.endHour} onChange={e => setF(p => ({ ...p, endHour: +e.target.value }))}
                            className="flex-1 rounded-xl px-2 py-2 text-sm focus:outline-none text-center"
                            style={{ backgroundColor: '#0C0C1A', border: '1px solid #111120', color: '#F1F0FF' }}>
                            {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                        </select>
                        <select value={f.endMinute} onChange={e => setF(p => ({ ...p, endMinute: +e.target.value }))}
                            className="flex-1 rounded-xl px-2 py-2 text-sm focus:outline-none text-center"
                            style={{ backgroundColor: '#0C0C1A', border: '1px solid #111120', color: '#F1F0FF' }}>
                            {MINS.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                        </select>
                    </div>
                </div>

                {/* Duration badge */}
                <div className="pt-5">
                    <span className="text-xs px-2 py-1 rounded-lg font-mono"
                        style={{ backgroundColor: c.color + '18', color: c.color }}>{durLabel}</span>
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <button onClick={() => onSave(f)} disabled={isSaving || !f.title.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: c.color, color: '#fff' }}>
                    <Check className="w-3 h-3" />{isSaving ? 'Saving…' : 'Save block'}
                </button>
                <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: '#141428', color: '#9896B8' }}>
                    <X className="w-3 h-3" />Cancel
                </button>
            </div>
        </div>
    );
}

// ── Block row ──────────────────────────────────────────────────────────────────
function BlockRow({ block, onEdit, onDelete }: { block: TemplateBlock; onEdit: () => void; onDelete: () => void }) {
    const [hov, setHov] = useState(false);
    const c = CAT[block.category] ?? CAT.neutral;
    const { Icon } = c;
    // Detect if exception memory has locked an adjusted time on any weekday
    const hasAdjusted = Object.keys(block.adjustedTimes ?? {}).length > 0;

    return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: hov ? '#0E0E1C' : 'transparent', border: `1px solid ${hov ? '#141428' : 'transparent'}` }}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
            <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: '#1E1E30', cursor: 'grab' }} />
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: '#EAEAFF' }}>{block.title}</p>
                    {hasAdjusted && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)' }}>adapted</span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <Icon className="w-3 h-3" style={{ color: c.color, opacity: 0.6 }} />
                    <span className="text-xs font-mono" style={{ color: '#4A4A6A' }}>{fmtTime(block.startHour, block.startMinute)} – {fmtTime(block.endHour, block.endMinute)}</span>
                    <span className="text-xs" style={{ color: '#3A3A5A' }}>{fmtDur(block.startHour, block.startMinute, block.endHour, block.endMinute)}</span>
                </div>
            </div>
            {hov && (
                <div className="flex gap-0.5 shrink-0">
                    <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#4A4A6A' }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9896B8')} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4A4A6A')}><Pencil className="w-3 h-3" /></button>
                    <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#4A4A6A' }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#f87171')} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4A4A6A')}><Trash2 className="w-3 h-3" /></button>
                </div>
            )}
        </div>
    );
}

// ── Template card ──────────────────────────────────────────────────────────────
function TemplateCard({ tmpl, onDeleted }: { tmpl: Template; onDeleted: () => void }) {
    const qc = useQueryClient();
    const { toast } = useToast();
    const [expanded, setExpanded] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(tmpl.name);
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [editBlock, setEditBlock] = useState<TemplateBlock | null>(null);

    const inv = () => qc.invalidateQueries({ queryKey: ['templates'] });

    const { mutate: updateTmpl } = useMutation({
        mutationFn: (data: any) => api.patch(`/schedule-templates/${tmpl.id}`, data).then(r => r.data),
        onSuccess: inv,
    });
    const { mutate: deleteTmpl, isPending: deleting } = useMutation({
        mutationFn: () => api.delete(`/schedule-templates/${tmpl.id}`).then(r => r.data),
        onSuccess: () => { inv(); onDeleted(); toast('Template removed.', 'success'); },
    });

    const toggleDay = (d: number) => {
        const days = tmpl.daysOfWeek.includes(d) ? tmpl.daysOfWeek.filter(x => x !== d) : [...tmpl.daysOfWeek, d].sort();
        updateTmpl({ daysOfWeek: days });
    };

    const saveBlock = (data: BlockForm) => {
        const existing = tmpl.blocks;
        if (editBlock) {
            const updated = existing.map(b => b.id === editBlock.id ? { ...b, ...data } : b);
            updateTmpl({ blocks: updated.map(({ id: _, ...rest }) => rest) });
            setEditBlock(null);
        } else {
            updateTmpl({ blocks: [...existing.map(({ id: _, ...rest }) => rest), { ...data, order: existing.length }] });
            setShowBlockForm(false);
        }
    };

    const deleteBlock = (blockId: string) => {
        const updated = tmpl.blocks.filter(b => b.id !== blockId);
        updateTmpl({ blocks: updated.map(({ id: _, ...rest }) => rest) });
    };

    return (
        <div className="rounded-2xl overflow-hidden" style={CARD}>
            {/* Template header */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid #0E0E1C` }}>
                {/* Active toggle */}
                <button onClick={() => updateTmpl({ isActive: !tmpl.isActive })}
                    className="w-8 h-5 rounded-full transition-all flex items-center shrink-0"
                    style={{ backgroundColor: tmpl.isActive ? 'rgba(124,58,237,0.4)' : '#111120', border: `1px solid ${tmpl.isActive ? 'rgba(124,58,237,0.6)' : '#1A1A2E'}` }}>
                    <div className="w-3.5 h-3.5 rounded-full transition-all ml-0.5"
                        style={{ backgroundColor: tmpl.isActive ? '#A78BFA' : '#3A3A5A', transform: tmpl.isActive ? 'translateX(12px)' : 'translateX(0)' }} />
                </button>

                {/* Name */}
                {editingName ? (
                    <input autoFocus type="text" value={nameVal} onChange={e => setNameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && nameVal.trim()) { updateTmpl({ name: nameVal.trim() }); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
                        onBlur={() => { if (nameVal.trim()) updateTmpl({ name: nameVal.trim() }); setEditingName(false); }}
                        className="flex-1 text-base font-semibold bg-transparent focus:outline-none"
                        style={{ color: '#F1F0FF', borderBottom: '1px solid #7C3AED' }} />
                ) : (
                    <h3 className="flex-1 text-base font-semibold cursor-pointer" style={{ color: tmpl.isActive ? '#F1F0FF' : '#4A4A6A' }}
                        onClick={() => setEditingName(true)}>{tmpl.name}</h3>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setExpanded(p => !p)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#3A3A5A' }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9896B8')} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#3A3A5A')}>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { if (window.confirm(`Remove template "${tmpl.name}"?`)) deleteTmpl(); }} disabled={deleting}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{ color: '#3A3A5A' }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#f87171')} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#3A3A5A')}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-5 py-4 space-y-5">
                    {/* Days of week */}
                    <div>
                        <p className="text-xs mb-2.5 flex items-center gap-1.5" style={{ color: '#3A3A5A' }}><Calendar className="w-3 h-3" />Active on</p>
                        <div className="flex gap-1.5">
                            {DAYS.map((d, i) => {
                                const active = tmpl.daysOfWeek.includes(i);
                                return (
                                    <button key={i} onClick={() => toggleDay(i)}
                                        className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                                        style={{ backgroundColor: active ? 'rgba(124,58,237,0.15)' : '#0C0C1A', border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : '#111120'}`, color: active ? '#A78BFA' : '#2A2A42' }}>
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Blocks */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs flex items-center gap-1.5" style={{ color: '#3A3A5A' }}><Clock className="w-3 h-3" />Time blocks</p>
                            <span className="text-xs" style={{ color: '#1E1E2E' }}>{tmpl.blocks.length} block{tmpl.blocks.length !== 1 ? 's' : ''}</span>
                        </div>

                        {tmpl.blocks.length === 0 && !showBlockForm && (
                            <div className="py-6 text-center rounded-xl" style={{ backgroundColor: '#0A0A14', border: '1px dashed #141428' }}>
                                <p className="text-xs" style={{ color: '#2A2A42' }}>No blocks yet. Add your typical schedule — work, gym, sleep…</p>
                            </div>
                        )}

                        <div className="space-y-1">
                            {tmpl.blocks.map(block => (
                                editBlock?.id === block.id ? (
                                    <BlockEditor key={block.id} initial={editBlock} onSave={d => saveBlock(d)} onCancel={() => setEditBlock(null)} isSaving={false} />
                                ) : (
                                    <BlockRow key={block.id} block={block} onEdit={() => { setShowBlockForm(false); setEditBlock(block); }} onDelete={() => { if (window.confirm(`Remove "${block.title}"?`)) deleteBlock(block.id); }} />
                                )
                            ))}
                        </div>

                        {showBlockForm && (
                            <div className="mt-2">
                                <BlockEditor onSave={d => saveBlock(d)} onCancel={() => setShowBlockForm(false)} isSaving={false} />
                            </div>
                        )}

                        {!showBlockForm && !editBlock && (
                            <button onClick={() => setShowBlockForm(true)}
                                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed #1A1A2E', color: '#3A3A5A' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#9896B8'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.color = '#3A3A5A'; }}>
                                <Plus className="w-3 h-3" />Add time block
                            </button>
                        )}
                    </div>

                    {/* Block count + confidence hint */}
                    {tmpl.blocks.length > 0 && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)' }}>
                            <Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#A78BFA', opacity: 0.6 }} />
                            <p className="text-xs leading-relaxed" style={{ color: '#4A4A6A' }}>
                                These blocks will appear as ghost entries on your timeline each {tmpl.daysOfWeek.map(d => FULLDAYS[d]).join(', ') || '—'}. Tap to confirm, adjust time, or dismiss.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── New template form ──────────────────────────────────────────────────────────
function NewTemplateForm({ onDone }: { onDone: () => void }) {
    const qc = useQueryClient();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

    const { mutate: create, isPending } = useMutation({
        mutationFn: (data: any) => api.post('/schedule-templates', data).then(r => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast('Template created.', 'success'); onDone(); },
        onError: () => toast('Could not create template.', 'error'),
    });

    const toggleDay = (d: number) => setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort());

    return (
        <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: '#0A0A18', border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 0 32px rgba(124,58,237,0.08)' }}>
            <div>
                <p className="text-xs mb-2" style={{ color: '#3A3A5A' }}>Template name</p>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Weekday, Weekend, Work from home…"
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
                    style={{ backgroundColor: '#06060E', border: '1px solid #1A1A2E', color: '#F1F0FF' }}
                    onFocus={e => (e.target.style.borderColor = '#7C3AED')} onBlur={e => (e.target.style.borderColor = '#1A1A2E')}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim() && days.length) create({ name: name.trim(), daysOfWeek: days, blocks: [] }); }} />
            </div>
            <div>
                <p className="text-xs mb-2" style={{ color: '#3A3A5A' }}>Active on</p>
                <div className="flex gap-1.5">
                    {DAYS.map((d, i) => {
                        const active = days.includes(i);
                        return (
                            <button key={i} onClick={() => toggleDay(i)}
                                className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                                style={{ backgroundColor: active ? 'rgba(124,58,237,0.15)' : '#0C0C1A', border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : '#111120'}`, color: active ? '#A78BFA' : '#2A2A42' }}>
                                {d}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => create({ name: name.trim(), daysOfWeek: days, blocks: [] })} disabled={isPending || !name.trim() || !days.length}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#7C3AED', color: '#fff' }}>
                    <Check className="w-3 h-3" />{isPending ? 'Creating…' : 'Create template'}
                </button>
                <button onClick={onDone} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs"
                    style={{ backgroundColor: '#141428', color: '#9896B8' }}>
                    <X className="w-3 h-3" />Cancel
                </button>
            </div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function RoutinePage() {
    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: () => api.get('/schedule-templates').then(r => r.data),
    });
    const qc = useQueryClient();
    const [showNew, setShowNew] = useState(false);

    return (
        <AppLayout>
            <TopBar />
            <div className="relative z-10 overflow-y-auto" style={{ height: 'calc(100vh - 56px)' }}>
                <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: '#F1F0FF' }}>Your Routine</h1>
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#4A4A6A' }}>
                                Define your typical day. Ghost entries will appear on your timeline each morning — confirm, adjust, or dismiss.
                            </p>
                        </div>
                        {!showNew && (
                            <button onClick={() => setShowNew(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shrink-0 transition-all"
                                style={{ backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.25)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.15)')}>
                                <Plus className="w-4 h-4" />New template
                            </button>
                        )}
                    </div>

                    {/* New template form */}
                    {showNew && <NewTemplateForm onDone={() => setShowNew(false)} />}

                    {/* How it works — shown when empty */}
                    {!isLoading && (templates as Template[]).length === 0 && !showNew && (
                        <div className="rounded-2xl p-6 space-y-4 text-center" style={{ backgroundColor: '#0A0A14', border: '1px dashed #141428' }}>
                            <div className="text-3xl">🗓</div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#F1F0FF' }}>No templates yet</p>
                                <p className="text-xs mt-1 leading-relaxed max-w-sm mx-auto" style={{ color: '#4A4A6A' }}>
                                    Create a template for your typical weekday or weekend. Add time blocks like "Work 9–5" or "Gym 6–7". Every morning, those blocks appear as ghosts on your timeline — one tap confirms them.
                                </p>
                            </div>
                            <button onClick={() => setShowNew(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                                style={{ backgroundColor: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#A78BFA' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.3)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,58,237,0.2)')}>
                                <Plus className="w-4 h-4" />Create your first template
                            </button>
                        </div>
                    )}

                    {/* Template list */}
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: '#0F0F1A' }} />)}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(templates as Template[]).map(t => (
                                <TemplateCard key={t.id} tmpl={t} onDeleted={() => qc.invalidateQueries({ queryKey: ['templates'] })} />
                            ))}
                        </div>
                    )}

                    {/* Bottom hint */}
                    {(templates as Template[]).length > 0 && (
                        <p className="text-xs text-center pb-4" style={{ color: '#1E1E2E' }}>
                            Ghost entries only appear on today's timeline. Past days are never auto-filled.
                        </p>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}