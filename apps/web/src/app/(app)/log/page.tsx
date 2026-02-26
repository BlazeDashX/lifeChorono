'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { fetchDayEntries } from '@/lib/api-entries';
import { Plus } from 'lucide-react';
import QuickAddModal from '@/components/QuickAddModal';

export default function LogPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries', dateStr],
    queryFn: () => fetchDayEntries(dateStr),
  });

  return (
    <div className="min-h-screen pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-md p-4 border-b border-slate-800 flex justify-between items-center">
        <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-2 text-neutral">←</button>
        <h1 className="text-lg font-bold">
          {format(selectedDate, 'MMMM d, yyyy')}
        </h1>
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 text-neutral">→</button>
      </header>

      {/* Timeline (1 minute = 1 pixel for easy math. 24 hours = 1440px) */}
      <div className="relative h-[1440px] mt-4 ml-16 mr-4 border-l border-slate-800">
        
        {/* Hour markers */}
        {[...Array(24)].map((_, i) => (
          <div key={i} className="absolute w-full border-t border-slate-800/50" style={{ top: `${i * 60}px` }}>
            <span className="absolute -left-14 -top-3 text-xs text-neutral">{i.toString().padStart(2, '0')}:00</span>
          </div>
        ))}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="absolute top-1/2 left-4 text-neutral">Loading your day...</div>
        )}

        {/* Entries */}
        {entries.map((entry: any) => {
          const startObj = new Date(entry.startTime);
          const topOffset = (startObj.getUTCHours() * 60) + startObj.getUTCMinutes();
          
          return (
            <div 
              key={entry.id}
              className={`absolute left-0 right-0 ml-2 rounded-md p-2 overflow-hidden border-l-4 bg-surface/80 backdrop-blur`}
              style={{
                top: `${topOffset}px`,
                height: `${entry.durationMinutes}px`,
                borderLeftColor: `var(--color-${entry.category})` // Assuming you map Tailwind vars to CSS vars
              }}
            >
              <p className="text-sm font-bold truncate leading-none">{entry.title}</p>
              {entry.durationMinutes >= 30 && (
                <p className="text-xs text-neutral mt-1">
                  {Math.floor(entry.durationMinutes / 60)}h {entry.durationMinutes % 60}m
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* FAB - Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand rounded-full flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-105 transition-transform z-20"
      >
        <Plus className="text-white w-6 h-6" />
      </button>

      <QuickAddModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedDate={selectedDate}
      />
    </div>
  );
}