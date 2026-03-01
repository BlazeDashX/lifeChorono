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
import { MoodBanner } from '@/components/mood/MoodBanner';
import { MoodModal } from '@/components/mood/MoodModal';
import { CardErrorBoundary } from '@/components/ui/CardErrorBoundary';                                            

async function fetchDashboard(date: string) {
  const res = await api.get(`/dashboard/week?weekStart=${date}`);
  return res.data;
}

export default function DashboardPage() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const dateStr   = format(weekStart, 'yyyy-MM-dd');
  const weekEnd   = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', dateStr],
    queryFn:  () => fetchDashboard(dateStr),
  });

  // ── TopBar: date range only — streak counter removed entirely ──────────
  const topBarRight = (
    <span className="text-xs hidden sm:block" style={{ color: '#9896B8' }}>
      {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
    </span>
  );

  if (error) {
    return (
      <AppLayout>
        <TopBar right={topBarRight} />
        <div className="p-8" style={{ color: '#f87171' }}>
          Error loading dashboard: {(error as Error).message}
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <AppLayout>
        <TopBar right={topBarRight} />
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TopBar right={topBarRight} />

      <div className="max-w-3xl mx-auto p-4 pb-28 md:pb-8 space-y-5">

        {/* Mood — crash here must never take down cards below */}
        <CardErrorBoundary>
          <MoodModal />
          <MoodBanner />
        </CardErrorBoundary>

        <CardErrorBoundary>
          <TodaySummary todaySummary={data.todaySummary} />
        </CardErrorBoundary>

        {/* 168h Donut */}
        <CardErrorBoundary>
          <div
            className="p-6 rounded-xl flex flex-col items-center"
            style={{ backgroundColor: '#0F0F1A', border: '1px solid #1A1A2E' }}
          >
            <Donut168 data={data} />
          </div>
        </CardErrorBoundary>

        <CardErrorBoundary>
          <GoalProgress goalProgress={data.goalProgress} />
        </CardErrorBoundary>

        {/* Daily Breakdown */}
        <CardErrorBoundary>
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
                    border:          '1px solid #1A1A2E',
                    borderRadius:    '10px',
                    fontSize:        '12px',
                  }}
                />
                <Bar dataKey="productive"  stackId="a" fill="#10B981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="leisure"     stackId="a" fill="#F59E0B" />
                <Bar dataKey="restoration" stackId="a" fill="#06B6D4" />
                <Bar dataKey="neutral"     stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardErrorBoundary>

        <CardErrorBoundary>
          <AiInsights />
        </CardErrorBoundary>

      </div>
    </AppLayout>
  );
}
