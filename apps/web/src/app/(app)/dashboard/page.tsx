'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { startOfWeek, format } from 'date-fns';
import Donut168 from '@/components/dashboard/Donut168';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fetchDashboard = async (date: string) => {
  const res = await api.get(`/api/dashboard/week?weekStart=${date}`);
  return res.data;
};

export default function DashboardPage() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Starts Monday
  const dateStr = format(weekStart, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', dateStr],
    queryFn: () => fetchDashboard(dateStr),
  });

  if (isLoading || !data) {
    return <div className="p-8 text-neutral animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 space-y-8">
      
      {/* Header & Streak */}
      <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">This Week</h1>
          <p className="text-sm text-neutral">{format(weekStart, 'MMM d')} - {format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')}</p>
        </div>
        <div className={`flex items-center gap-2 font-bold px-3 py-1 rounded-full ${data.streakDays > 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-neutral'}`}>
          🔥 {data.streakDays} Day Streak
        </div>
      </div>

      {/* 168 Hour Donut */}
      <div className="bg-surface p-6 rounded-xl border border-slate-800 flex flex-col items-center">
        <Donut168 data={data} />
      </div>

      {/* Daily Breakdown Stacked Bar Chart */}
      <div className="bg-surface p-6 rounded-xl border border-slate-800 h-72">
        <h3 className="text-sm font-bold text-neutral mb-4 uppercase tracking-wider">Daily Distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.dailyBreakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'EE')} stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#1E293B' }} 
              contentStyle={{ backgroundColor: '#13131A', border: '1px solid #1E293B', borderRadius: '8px' }} 
            />
            <Bar dataKey="productive" stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
            <Bar dataKey="leisure" stackId="a" fill="#F59E0B" />
            <Bar dataKey="restoration" stackId="a" fill="#06B6D4" />
            <Bar dataKey="neutral" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
    </div>
  );
}