'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntry } from '@/lib/api-entries';
import { format } from 'date-fns';

export default function QuickAddModal({ 
  isOpen, 
  onClose, 
  selectedDate 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  selectedDate: Date;
}) {
  const queryClient = useQueryClient();
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'productive' | 'leisure' | 'restoration' | 'neutral' | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

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
            value={startTime} 
            onChange={(e) => setStartTime(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-lg text-white"
          />
          <input 
            type="time" 
            value={endTime} 
            onChange={(e) => setEndTime(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-lg text-white"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 p-3 rounded-lg bg-slate-800 text-white font-medium">Cancel</button>
          <button 
            disabled={!title || !category}
            onClick={() => {
              mutation.mutate({
                title,
                category,
                startTime: `${dateStr}T${startTime}:00Z`,
                endTime: `${dateStr}T${endTime}:00Z`,
              });
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