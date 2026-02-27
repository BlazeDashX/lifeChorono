import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getWeeklyDashboard(userId: string, weekStartString: string) {
    const weekStart = new Date(weekStartString);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { weeklyGoals: true },
    });

    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    });

    const breakdown = { productive: 0, leisure: 0, restoration: 0, neutral: 0 };
    let loggedMinutes = 0;

    const dailyBreakdown = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        productive: 0, leisure: 0, restoration: 0, neutral: 0,
      };
    });

    entries.forEach(entry => {
      const cat = entry.category;
      const hours = entry.durationMinutes / 60;
      breakdown[cat] += hours;
      loggedMinutes += entry.durationMinutes;

      const entryDateStr = entry.date.toISOString().split('T')[0];
      const dayData = dailyBreakdown.find(d => d.date === entryDateStr);
      if (dayData) dayData[cat] += hours;
    });

    // ── Goals ──────────────────────────────────────────────────────────────
    const defaultGoals = { productive: 40, leisure: 28, restoration: 56, neutral: 20 };
    const goals = (
      user?.weeklyGoals && Object.keys(user.weeklyGoals).length
        ? user.weeklyGoals
        : defaultGoals
    ) as Record<string, number>;

    // Goal progress per category
    const goalProgress = {
      productive: {
        logged: parseFloat(breakdown.productive.toFixed(2)),
        goal: goals.productive,
        percent: Math.round((breakdown.productive / goals.productive) * 100),
        remaining: parseFloat((goals.productive - breakdown.productive).toFixed(2)),
        met: breakdown.productive >= goals.productive,
      },
      leisure: {
        logged: parseFloat(breakdown.leisure.toFixed(2)),
        goal: goals.leisure,
        percent: Math.round((breakdown.leisure / goals.leisure) * 100),
        remaining: parseFloat((goals.leisure - breakdown.leisure).toFixed(2)),
        met: breakdown.leisure >= goals.leisure,
      },
      restoration: {
        logged: parseFloat(breakdown.restoration.toFixed(2)),
        goal: goals.restoration,
        percent: Math.round((breakdown.restoration / goals.restoration) * 100),
        remaining: parseFloat((goals.restoration - breakdown.restoration).toFixed(2)),
        met: breakdown.restoration >= goals.restoration,
      },
      neutral: {
        logged: parseFloat(breakdown.neutral.toFixed(2)),
        goal: goals.neutral,
        percent: Math.round((breakdown.neutral / goals.neutral) * 100),
        remaining: parseFloat((goals.neutral - breakdown.neutral).toFixed(2)),
        met: breakdown.neutral >= goals.neutral,
      },
    };

    // ── Today's summary ────────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(
      e => e.date.toISOString().split('T')[0] === todayStr
    );

    const todaySummary = {
      date: todayStr,
      productive: parseFloat(
        todayEntries
          .filter(e => e.category === 'productive')
          .reduce((sum, e) => sum + e.durationMinutes / 60, 0)
          .toFixed(2)
      ),
      leisure: parseFloat(
        todayEntries
          .filter(e => e.category === 'leisure')
          .reduce((sum, e) => sum + e.durationMinutes / 60, 0)
          .toFixed(2)
      ),
      restoration: parseFloat(
        todayEntries
          .filter(e => e.category === 'restoration')
          .reduce((sum, e) => sum + e.durationMinutes / 60, 0)
          .toFixed(2)
      ),
      neutral: parseFloat(
        todayEntries
          .filter(e => e.category === 'neutral')
          .reduce((sum, e) => sum + e.durationMinutes / 60, 0)
          .toFixed(2)
      ),
      totalLogged: parseFloat(
        todayEntries.reduce((sum, e) => sum + e.durationMinutes / 60, 0).toFixed(2)
      ),
      entryCount: todayEntries.length,
      // Which categories have nothing logged today
      missing: ['productive', 'leisure', 'restoration', 'neutral'].filter(
        cat => !todayEntries.some(e => e.category === cat)
      ),
    };

    // ── Streak ─────────────────────────────────────────────────────────────
    const allEntries = await this.prisma.timeEntry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    const loggedDates = new Set(
      allEntries.map(e => e.date.toISOString().split('T')[0])
    );

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const loggedToday = loggedDates.has(todayStr);
    const loggedYesterday = loggedDates.has(yesterdayStr);

    let streakDays = 0;
    let streakStatus: 'green' | 'amber' | 'none' = 'none';

    if (loggedToday) {
      streakStatus = 'green';
      let checkDate = new Date(today);
      while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else if (loggedYesterday) {
      streakStatus = 'amber';
      let checkDate = new Date(yesterday);
      while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      totalHours: 168,
      loggedHours: parseFloat((loggedMinutes / 60).toFixed(2)),
      unloggedHours: parseFloat((168 - loggedMinutes / 60).toFixed(2)),
      breakdown,
      goals,
      goalProgress,
      todaySummary,
      dailyBreakdown,
      avgMoodScore: null,
      streakDays,
      streakStatus,
    };
  }
}