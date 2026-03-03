'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sparkles, X } from 'lucide-react';

interface S { blockId:string; dayOfWeek:number; message:string; }

export default function AdaptationBanner({ s }:{ s:S }) {
  const qc = useQueryClient();
  const [gone, setGone] = useState(false);
  const done = () => { qc.invalidateQueries({queryKey:['adaptations']}); setGone(true); };
  const { mutate:apply, isPending } = useMutation({
    mutationFn: () => api.post(`/schedule-templates/adaptations/${s.blockId}/apply`,{dayOfWeek:s.dayOfWeek}).then(r=>r.data),
    onSuccess: done,
  });
  const { mutate:keep } = useMutation({
    mutationFn: () => api.post(`/schedule-templates/adaptations/${s.blockId}/dismiss`,{dayOfWeek:s.dayOfWeek}).then(r=>r.data),
    onSuccess: done,
  });
  if (gone) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-2"
      style={{backgroundColor:'rgba(124,58,237,0.06)',border:'1px solid rgba(124,58,237,0.15)'}}>
      <Sparkles className="w-3.5 h-3.5 shrink-0" style={{color:'#A78BFA'}} />
      <p className="flex-1 text-xs leading-relaxed" style={{color:'#9896B8'}}>{s.message}</p>
      <button onClick={()=>apply()} disabled={isPending}
        className="text-xs px-2.5 py-1 rounded-lg font-medium"
        style={{backgroundColor:'rgba(124,58,237,0.2)',color:'#A78BFA',border:'1px solid rgba(124,58,237,0.3)'}}>
        Update
      </button>
      <button onClick={()=>keep()} style={{color:'#3A3A5A'}}
        onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#9896B8')}
        onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#3A3A5A')}>
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}