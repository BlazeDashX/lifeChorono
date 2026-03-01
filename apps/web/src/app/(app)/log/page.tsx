'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { fetchDayEntries } from '@/lib/api-entries';
import { api } from '@/lib/api';
import {
  Plus, ChevronLeft, ChevronRight,
  Pencil, Trash2, Check, X,
} from 'lucide-react';
import QuickAddModal from '@/components/QuickAddModal';
import Suggestions from '@/components/log/Suggestions';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { LogSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/lib/toast';

// ── Colour map ────────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  productive:  '#10B981',
  leisure:     '#F59E0B',
  restoration: '#06B6D4',
  neutral:     '#64748B',
};

const CATEGORIES = ['productive', 'leisure', 'restoration', 'neutral'] as const;
type Category = typeof CATEGORIES[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** ISO string → "HH:mm" for <input type="time"> */
function isoToTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** dateStr "yyyy-MM-dd" + "HH:mm" → ISO string the API expects */
function buildIso(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00.000Z`;
}

// ── Inline edit form ──────────────────────────────────────────────────────────

interface EditState {
  title:     string;
  category:  Category;
  note:      string;
  startTime: string; // "HH:mm"
  endTime:   string; // "HH:mm"
}

function EditForm({
  entry,
  dateStr,
  onSave,
  onCancel,
  isSaving,
}: {
  entry:    any;
  dateStr:  string;
  onSave:   (s: EditState) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<EditState>({
    title:     entry.title,
    category:  entry.category as Category,
    note:      entry.note ?? '',
    startTime: isoToTime(entry.startTime),
    endTime:   isoToTime(entry.endTime),
  });

  const color = CAT_COLOR[form.category] ?? '#64748B';

  return (
    <div
      className="rounded-xl p-3 space-y-2 z-10"
      style={{
        backgroundColor: '#14142A',
        border:           `1px solid ${color}55`,
        borderLeft:       `3px solid ${color}`,
      }}
    >
      {/* Title */}
      <input
        autoFocus
        type="text"
        value={form.title}
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        placeholder="Entry title"
        className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        style={{
          backgroundColor: '#0F0F1A',
          border:           '1px solid #1A1A2E',
          color:            '#F1F0FF',
        }}
        onFocus={e  => (e.target.style.borderColor = color)}
        onBlur={e   => (e.target.style.borderColor = '#1A1A2E')}
      />

      {/* Category + start/end time */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={form.category}
          onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))}
          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-1 min-w-[120px]"
          style={{
            backgroundColor: '#0F0F1A',
            border:           '1px solid #1A1A2E',
            color:            '#F1F0FF',
          }}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="time"
          value={form.startTime}
          onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none w-[90px]"
          style={{
            backgroundColor: '#0F0F1A',
            border:           '1px solid #1A1A2E',
            color:            '#F1F0FF',
          }}
        />

        <span className="text-xs self-center" style={{ color: '#4A4A6A' }}>→</span>

        <input
          type="time"
          value={form.endTime}
          onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
          className="rounded-lg px-2 py-1.5 text-xs focus:outline-none w-[90px]"
          style={{
            backgroundColor: '#0F0F1A',
            border:           '1px solid #1A1A2E',
            color:            '#F1F0FF',
          }}
        />
      </div>

      {/* Note */}
      <input
        type="text"
        value={form.note}
        onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
        placeholder="Note (optional)"
        className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none"
        style={{
          backgroundColor: '#0F0F1A',
          border:           '1px solid #1A1A2E',
          color:            '#9896B8',
        }}
      />

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                     font-semibold transition-all disabled:opacity-40"
          style={{ backgroundColor: color, color: '#fff' }}
        >
          <Check className="w-3 h-3" />
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                     transition-all"
          style={{ backgroundColor: '#1A1A2E', color: '#9896B8' }}
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LogPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [prefillData,  setPrefillData]  = useState<any>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries', dateStr],
    queryFn:  () => fetchDayEntries(dateStr),
  });

  // ── Update ────────────────────────────────────────────────────────────────
  const { mutate: updateEntry, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.patch(`/entries/${id}`, body).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingId(null);
      toast('Entry updated.', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.message ?? 'Could not save changes.', 'error');
    },
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const { mutate: deleteEntry } = useMutation({
    mutationFn: (id: string) => api.delete(`/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('Entry deleted.', 'success');
    },
    onError: () => toast('Could not delete entry.', 'error'),
  });

  const handleSave = (id: string, form: EditState) => {
    updateEntry({
      id,
      body: {
        title:     form.title.trim(),
        category:  form.category,
        note:      form.note.trim() || undefined,
        startTime: buildIso(dateStr, form.startTime),
        endTime:   buildIso(dateStr, form.endTime),
      },
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Delete "${title}"?`)) deleteEntry(id);
  };

  // ── TopBar: date navigator ────────────────────────────────────────────────
  const topBarRight = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setSelectedDate(subDays(selectedDate, 1))}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: '#9896B8' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#14142A';
          (e.currentTarget as HTMLElement).style.color = '#F1F0FF';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#9896B8';
        }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="text-center min-w-[120px]">
        <span className="text-sm font-medium" style={{ color: '#F1F0FF' }}>
          {format(selectedDate, 'MMM d, yyyy')}
        </span>
        {isToday && (
          <span className="ml-2 text-xs font-medium" style={{ color: '#7C3AED' }}>
            Today
          </span>
        )}
      </div>

      <button
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        className="p-1.5 rounded-lg transition-colors"
        style={{ color: '#9896B8' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = '#14142A';
          (e.currentTarget as HTMLElement).style.color = '#F1F0FF';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#9896B8';
        }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <AppLayout>
        <TopBar right={topBarRight} />
        <LogSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TopBar right={topBarRight} />

      <div className="max-w-2xl mx-auto pb-28 md:pb-8">

        <Suggestions
          dateStr={dateStr}
          onSelect={(task: any) => {
            setPrefillData(task);
            setIsModalOpen(true);
          }}
        />

        {/* ── Timeline ── */}
        <div
          className="relative h-[1440px] mt-4 ml-16 mr-4"
          style={{ borderLeft: '1px solid #1A1A2E' }}
        >
          {/* Hour lines */}
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full"
              style={{
                top:       `${i * 60}px`,
                borderTop: '1px solid rgba(26,26,46,0.5)',
              }}
            >
              <span
                className="absolute -left-14 -top-3 text-xs"
                style={{ color: '#4A4A6A' }}
              >
                {i.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* Empty state */}
          {entries.length === 0 && (
            <div className="absolute top-24 left-0 right-0">
              <EmptyState type="empty-day" />
            </div>
          )}

          {/* Entry blocks */}
          {(entries as any[]).map(entry => {
            const startObj  = new Date(entry.startTime);
            const topOffset = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
            const color     = CAT_COLOR[entry.category] ?? '#64748B';
            const isEditing = editingId === entry.id;

            return (
              <div
                key={entry.id}
                className="absolute left-0 right-0 ml-2"
                style={{
                  top:       `${topOffset}px`,
                  minHeight: `${Math.max(entry.durationMinutes, 24)}px`,
                }}
              >
                {isEditing ? (
                  // ── Edit form ──
                  <EditForm
                    entry={entry}
                    dateStr={dateStr}
                    onSave={form => handleSave(entry.id, form)}
                    onCancel={() => setEditingId(null)}
                    isSaving={isUpdating}
                  />
                ) : (
                  // ── Read-only block ──
                  <div
                    className="group relative rounded-lg p-2 overflow-hidden
                               transition-all hover:brightness-110 cursor-default"
                    style={{
                      height:          `${Math.max(entry.durationMinutes, 24)}px`,
                      borderLeft:      `3px solid ${color}`,
                      backgroundColor: `${color}18`,
                    }}
                  >
                    {/* Title */}
                    <p
                      className="text-xs font-semibold truncate pr-16"
                      style={{ color: '#F1F0FF' }}
                    >
                      {entry.title}
                    </p>

                    {/* Duration — only if block is tall enough */}
                    {entry.durationMinutes >= 30 && (
                      <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>
                        {Math.floor(entry.durationMinutes / 60)}h{' '}
                        {entry.durationMinutes % 60}m
                      </p>
                    )}

                    {/* Edit / Delete — appear on hover */}
                    <div
                      className="absolute top-1.5 right-1.5 flex gap-1
                                 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        onClick={() => setEditingId(entry.id)}
                        title="Edit entry"
                        className="p-1 rounded-md transition-colors"
                        style={{
                          backgroundColor: 'rgba(15,15,26,0.85)',
                          color:            '#9896B8',
                        }}
                        onMouseEnter={e =>
                          ((e.currentTarget as HTMLElement).style.color = '#F1F0FF')
                        }
                        onMouseLeave={e =>
                          ((e.currentTarget as HTMLElement).style.color = '#9896B8')
                        }
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleDelete(entry.id, entry.title)}
                        title="Delete entry"
                        className="p-1 rounded-md transition-colors"
                        style={{
                          backgroundColor: 'rgba(15,15,26,0.85)',
                          color:            '#f87171',
                        }}
                        onMouseEnter={e =>
                          ((e.currentTarget as HTMLElement).style.backgroundColor =
                            'rgba(248,113,113,0.15)')
                        }
                        onMouseLeave={e =>
                          ((e.currentTarget as HTMLElement).style.backgroundColor =
                            'rgba(15,15,26,0.85)')
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── FAB ── */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 rounded-full
                     flex items-center justify-center z-20
                     hover:scale-105 active:scale-95 transition-transform duration-150"
          style={{
            backgroundColor: '#7C3AED',
            boxShadow:       '0 0 24px rgba(124,58,237,0.4)',
          }}
        >
          <Plus className="text-white w-6 h-6" />
        </button>

        <QuickAddModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setPrefillData(null);
          }}
          selectedDate={selectedDate}
          prefillData={prefillData}
        />
      </div>
    </AppLayout>
  );
}