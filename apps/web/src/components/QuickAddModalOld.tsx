'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntry } from '@/lib/api-entries';
import { format } from 'date-fns';

export default function QuickAddModal({ 
  isOpen, 
  onClose, 
  selectedDate,
  prefillData
}: { 
  isOpen: boolean; 
  onClose: () => void;
  selectedDate: Date;
  prefillData?: any;
}) {
  const queryClient = useQueryClient();
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const [title, setTitle] = useState(prefillData?.title || '');
  const [category, setCategory] = useState<'productive' | 'leisure' | 'restoration' | 'neutral' | null>(prefillData?.category || null);
  const [moodScore, setMoodScore] = useState(3);

  // Calculate default times based on recurring task
  const getDefaultTimes = () => {
    if (prefillData?.defaultDuration) {
      // For recurring tasks, set reasonable default times for today
      const now = new Date();
      const start = new Date(now);
      start.setHours(9, 0, 0, 0); // Default to 9 AM
      const end = new Date(start);
      end.setMinutes(start.getMinutes() + prefillData.defaultDuration);
      
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      
      return {
        startTime: `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`,
        endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`,
      };
    }
    return { startTime: '09:00', endTime: '10:00' };
  };
  
  const { startTime, endTime } = getDefaultTimes();
  const [timeStart, setTimeStart] = useState(startTime);
  const [timeEnd, setTimeEnd] = useState(endTime);

  const mutation = useMutation({
    mutationFn: createEntry,
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['entries', dateStr] });
      const previousEntries = queryClient.getQueryData(['entries', dateStr]);
      
      // Optimistic update: instantly show the entry on the timeline
      queryClient.setQueryData(['entries', dateStr], (old: any) => [...(old || []), {
        ...newEntry,
        id: 'temp-id-' + Date.now(),
        durationMinutes: 60, // Rough estimate for optimistic UI
      }]);

      return { previousEntries };
    },
    onError: (err, newEntry, context) => {
      queryClient.setQueryData(['entries', dateStr], context?.previousEntries);
      alert('Failed to save entry');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', dateStr] });
      onClose();
      // Reset form
      setTitle('');
      setCategory(null);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom-10">
        <h2 className="text-xl font-bold">Log Time</h2>
        
        <div className="grid grid-cols-2 gap-2">
          {['productive', 'leisure', 'restoration', 'neutral'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat as any)}
              className={`p-3 rounded-lg capitalize font-medium border ${
                category === cat ? `border-${cat} bg-${cat}/20` : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input 
          autoFocus
          type="text" 
          placeholder="What are you doing?" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-white mt-2"
        />

        <div className="flex gap-4">
          <input 
            type="time" 
            value={timeStart} 
            onChange={(e) => setTimeStart(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-lg text-white"
          />
          <input 
            type="time" 
            value={timeEnd} 
            onChange={(e) => setTimeEnd(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-lg text-white"
          />
        </div>

        <div className="mt-6 p-4 bg-gray-900/30 rounded-2xl border border-gray-800">
          <p className="text-[10px] uppercase font-black text-gray-500 mb-3 tracking-widest">Energy Level</p>
          <div className="flex justify-between items-center">
            {[
              { v: 1, e: '😫' },
              { v: 2, e: '😕' },
              { v: 3, e: '🙂' },
              { v: 4, e: '😊' },
              { v: 5, e: '🤩' }
            ].map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMoodScore(m.v)}
                className={`text-3xl transition-all duration-300 ${
                  moodScore === m.v 
                    ? 'scale-150 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                    : 'opacity-30 grayscale hover:grayscale-0 hover:opacity-100'
                }`}
              >
                {m.e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 p-3 rounded-lg bg-slate-800 text-white font-medium">Cancel</button>
          <button 
            disabled={!title || !category}
            onClick={() => {
              const entryData = {
                title,
                category,
                startTime: `${dateStr}T${timeStart}:00Z`,
                endTime: `${dateStr}T${timeEnd}:00Z`,
                moodScore,
                // Link to recurring task if this came from a suggestion
                ...(prefillData?.id && { recurringTaskId: prefillData.id })
              };
              mutation.mutate(entryData);
            }} 
            className="flex-1 p-3 rounded-lg bg-brand hover:bg-brand-light text-white font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}