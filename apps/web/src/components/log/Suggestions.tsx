'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSuggestions } from '@/lib/api-recurring';
import { Plus } from 'lucide-react';

export default function Suggestions({ dateStr, onSelect }: { dateStr: string, onSelect: (task: any) => void }) {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions', dateStr],
    queryFn: () => fetchSuggestions(dateStr),
  });

  if (isLoading || !suggestions || suggestions.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-4 pt-2 hide-scrollbar">
      <div className="flex gap-3 px-4">
        {suggestions.map((task: any) => (
          <button
            key={task.id}
            onClick={() => onSelect(task)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border border-slate-700 bg-surface hover:bg-slate-800 transition-colors border-l-4 border-l-${task.category}`}
          >
            <Plus className="w-4 h-4 text-neutral" />
            <span className="text-sm font-medium whitespace-nowrap">{task.title}</span>
            <span className="text-xs text-neutral ml-1">{Math.round(task.defaultDuration / 60)}h</span>
          </button>
        ))}
      </div>
    </div>
  );
}