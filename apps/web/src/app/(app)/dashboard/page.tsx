'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { startOfWeek, format } from 'date-fns';
import Donut168 from '@/components/dashboard/Donut168';
import GoalProgress from '@/components/dashboard/GoalProgress';
import TodaySummary from '@/components/dashboard/TodaySummary';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AppLayout from '@/components/layout/AppLayout';
import AiInsights from '@/components/dashboard/AiInsights';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import TopBar from '@/components/layout/TopBar';

async function fetchDashboard(date: string) {
  const res = await api.get(`/dashboard/week?weekStart=${date}`);
  return res.data;
}

export default function DashboardPage() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const dateStr = format(weekStart, 'yyyy-MM-dd');
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', dateStr],
    queryFn: () => fetchDashboard(dateStr),
  });

  if (error) {
    return (
      <AppLayout>
        <TopBar />
        <div className="p-8" style={{ color: '#f87171' }}>
          Error loading dashboard: {(error as Error).message}
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <AppLayout>
        <TopBar />
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  const streakColors = {
    green: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
    amber: { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B' },
    none:  { bg: 'rgba(100,116,139,0.15)', color: '#64748B' },
  }[data.streakStatus as 'green' | 'amber' | 'none'] ?? { bg: 'rgba(100,116,139,0.15)', color: '#64748B' };

  const streakTooltip = {
    green: 'Logged today ✓',
    amber: 'Not logged today yet',
    none:  'No streak',
  }[data.streakStatus as string] ?? '';

  // Top bar right slot — week range + streak
  const topBarRight = (
    <div className="flex items-center gap-3">
      <span className="text-xs hidden sm:block" style={{ color: '#9896B8' }}>
        {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
      </span>
      <div className="flex flex-col items-end">
        <div
          className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: streakColors.bg, color: streakColors.color }}
        >
          🔥 {data.streakDays}d
        </div>
        {streakTooltip && (
          <span className="text-xs mt-0.5 hidden sm:block" style={{ color: '#4A4A6A' }}>
            {streakTooltip}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <TopBar right={topBarRight} />

      <div className="max-w-3xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* Today's Summary */}
        <TodaySummary todaySummary={data.todaySummary} />

        {/* 168 Hour Donut */}
        <div
          className="p-6 rounded-xl flex flex-col items-center"
          style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
        >
          <Donut168 data={data} />
        </div>

        {/* Weekly Goal Progress */}
        <GoalProgress goalProgress={data.goalProgress} />

        {/* Daily Breakdown */}
        <div
          className="p-6 rounded-xl h-72"
          style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
        >
          <h3
            className="text-xs font-bold mb-4 uppercase tracking-wider"
            style={{ color: '#9896B8' }}
          >
            Daily Distribution
          </h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart
              data={data.dailyBreakdown}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(val) => format(new Date(val), 'EE')}
                stroke="#4A4A6A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(26,26,46,0.6)' }}
                contentStyle={{
                  backgroundColor: '#0F0F1A',
                  border: '1px solid #1A1A2E',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="productive"  stackId="a" fill="#10B981" radius={[0,0,4,4]} />
              <Bar dataKey="leisure"     stackId="a" fill="#F59E0B" />
              <Bar dataKey="restoration" stackId="a" fill="#06B6D4" />
              <Bar dataKey="neutral"     stackId="a" fill="#64748B" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Insights */}
        <AiInsights />

      </div>
    </AppLayout>
  );
}