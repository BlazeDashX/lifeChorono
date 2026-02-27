'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays } from 'date-fns';
import { fetchDayEntries } from '@/lib/api-entries';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import QuickAddModal from '@/components/QuickAddModal';
import Suggestions from '@/components/log/Suggestions';
import AppLayout from '@/components/layout/AppLayout';
import TopBar from '@/components/layout/TopBar';
import { LogSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function LogPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<any>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['entries', dateStr],
    queryFn: () => fetchDayEntries(dateStr),
  });

  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  // Date nav in top bar
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

        {/* Suggestions */}
        <Suggestions dateStr={dateStr} onSelect={(task: any) => {
          setPrefillData(task);
          setIsModalOpen(true);
        }} />

        {/* Timeline */}
        <div
          className="relative h-[1440px] mt-4 ml-16 mr-4"
          style={{ borderLeft: '1px solid #1A1A2E' }}
        >
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full"
              style={{ top: `${i * 60}px`, borderTop: '1px solid rgba(26,26,46,0.5)' }}
            >
              <span
                className="absolute -left-14 -top-3 text-xs"
                style={{ color: '#4A4A6A' }}
              >
                {i.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {entries.length === 0 && (
            <div className="absolute top-24 left-0 right-0">
              <EmptyState type="empty-day" />
            </div>
          )}

          {entries.map((entry: any) => {
            const startObj = new Date(entry.startTime);
            const topOffset = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
            const color =
              entry.category === 'productive'  ? '#10B981' :
              entry.category === 'leisure'     ? '#F59E0B' :
              entry.category === 'restoration' ? '#06B6D4' : '#64748B';

            return (
              <div
                key={entry.id}
                className="absolute left-0 right-0 ml-2 rounded-lg p-2 overflow-hidden
                           cursor-pointer transition-all hover:brightness-110"
                style={{
                  top:             `${topOffset}px`,
                  height:          `${Math.max(entry.durationMinutes, 20)}px`,
                  borderLeft:      `3px solid ${color}`,
                  backgroundColor: `${color}18`,
                }}
              >
                <p className="text-xs font-semibold truncate" style={{ color: '#F1F0FF' }}>
                  {entry.title}
                </p>
                {entry.durationMinutes >= 30 && (
                  <p className="text-xs mt-0.5" style={{ color: '#9896B8' }}>
                    {Math.floor(entry.durationMinutes / 60)}h {entry.durationMinutes % 60}m
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* FAB */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 rounded-full
                     flex items-center justify-center
                     hover:scale-105 active:scale-95 transition-transform duration-150 z-20"
          style={{
            backgroundColor: '#7C3AED',
            boxShadow: '0 0 24px rgba(124,58,237,0.4)',
          }}
        >
          <Plus className="text-white w-6 h-6" />
        </button>

        <QuickAddModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setPrefillData(null); }}
          selectedDate={selectedDate}
          prefillData={prefillData}
        />
      </div>
    </AppLayout>
  );
}