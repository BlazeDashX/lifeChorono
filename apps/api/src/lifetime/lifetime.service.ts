import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LifetimeService {
  constructor(private prisma: PrismaService) {}

  // ─── All-time stats ───────────────────────────────────────────────────────
  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, name: true },
    });

    const snapshots = await this.prisma.weeklySnapshot.findMany({
      where: { userId },
      orderBy: { weekStart: 'asc' },
    });

    const allEntries = await this.prisma.timeEntry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    // ── Totals ──
    const totals = snapshots.reduce(
      (acc, s) => ({
        productive:  acc.productive  + s.productiveHrs,
        leisure:     acc.leisure     + s.leisureHrs,
        restoration: acc.restoration + s.restorationHrs,
        neutral:     acc.neutral     + s.neutralHrs,
        total:       acc.total       + s.totalLoggedHrs,
      }),
      { productive: 0, leisure: 0, restoration: 0, neutral: 0, total: 0 },
    );

    // ── Member since ──
    const memberSince = user?.createdAt ?? new Date();
    const memberDays = Math.floor(
      (Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24),
    );

    // ── Consistency score — avg across all snapshots ──
    const avgConsistency =
      snapshots.length > 0
        ? snapshots.reduce((sum, s) => sum + s.consistencyScore, 0) /
          snapshots.length
        : 0;

    // ── Personal records ──
    const bestProductiveWeek = snapshots.reduce(
      (best, s) =>
        s.productiveHrs > (best?.productiveHrs ?? 0) ? s : best,
      null as typeof snapshots[0] | null,
    );

    const bestRestorationWeek = snapshots.reduce(
      (best, s) =>
        s.restorationHrs > (best?.restorationHrs ?? 0) ? s : best,
      null as typeof snapshots[0] | null,
    );

    const bestConsistencyWeek = snapshots.reduce(
      (best, s) =>
        s.consistencyScore > (best?.consistencyScore ?? 0) ? s : best,
      null as typeof snapshots[0] | null,
    );

    // ── Longest streak ──
    const longestStreak = this.computeLongestStreak(allEntries);

    // ── Total weeks tracked ──
    const weeksTracked = snapshots.length;

    return {
      userName: user?.name,
      memberSince: memberSince.toISOString().split('T')[0],
      memberDays,
      weeksTracked,
      totals: {
        productive:  parseFloat(totals.productive.toFixed(1)),
        leisure:     parseFloat(totals.leisure.toFixed(1)),
        restoration: parseFloat(totals.restoration.toFixed(1)),
        neutral:     parseFloat(totals.neutral.toFixed(1)),
        total:       parseFloat(totals.total.toFixed(1)),
      },
      avgConsistency: parseFloat(avgConsistency.toFixed(1)),
      records: {
        bestProductiveWeek: bestProductiveWeek
          ? {
              value: parseFloat(bestProductiveWeek.productiveHrs.toFixed(1)),
              weekStart: bestProductiveWeek.weekStart.toISOString().split('T')[0],
            }
          : null,
        bestRestorationWeek: bestRestorationWeek
          ? {
              value: parseFloat(bestRestorationWeek.restorationHrs.toFixed(1)),
              weekStart: bestRestorationWeek.weekStart.toISOString().split('T')[0],
            }
          : null,
        bestConsistencyWeek: bestConsistencyWeek
          ? {
              value: parseFloat(bestConsistencyWeek.consistencyScore.toFixed(1)),
              weekStart: bestConsistencyWeek.weekStart.toISOString().split('T')[0],
            }
          : null,
        longestStreak: {
          value: longestStreak.days,
          startDate: longestStreak.startDate,
          endDate: longestStreak.endDate,
        },
      },
    };
  }

  // ─── Monthly breakdown for bar chart ─────────────────────────────────────
  async getMonthly(userId: string, year: number) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

    const snapshots = await this.prisma.weeklySnapshot.findMany({
      where: {
        userId,
        weekStart: { gte: yearStart, lte: yearEnd },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Group by month
    const months = Array.from({ length: 12 }).map((_, i) => ({
      month: new Date(year, i, 1).toLocaleDateString('en-US', { month: 'short' }),
      monthIndex: i,
      productive:  0,
      leisure:     0,
      restoration: 0,
      neutral:     0,
      totalLogged: 0,
    }));

    snapshots.forEach(s => {
      const monthIndex = s.weekStart.getMonth();
      months[monthIndex].productive  += s.productiveHrs;
      months[monthIndex].leisure     += s.leisureHrs;
      months[monthIndex].restoration += s.restorationHrs;
      months[monthIndex].neutral     += s.neutralHrs;
      months[monthIndex].totalLogged += s.totalLoggedHrs;
    });

    return months.map(m => ({
      ...m,
      productive:  parseFloat(m.productive.toFixed(1)),
      leisure:     parseFloat(m.leisure.toFixed(1)),
      restoration: parseFloat(m.restoration.toFixed(1)),
      neutral:     parseFloat(m.neutral.toFixed(1)),
      totalLogged: parseFloat(m.totalLogged.toFixed(1)),
    }));
  }

  // ─── Mood × Productive correlation ───────────────────────────────────────
  async getMoodCorrelation(userId: string) {
    const snapshots = await this.prisma.weeklySnapshot.findMany({
      where: {
        userId,
        avgMoodScore: { not: null },
      },
      orderBy: { weekStart: 'asc' },
      take: 24, // last 24 weeks
    });

    return snapshots.map(s => ({
      weekStart:       s.weekStart.toISOString().split('T')[0],
      avgMoodScore:    s.avgMoodScore ? parseFloat(s.avgMoodScore.toFixed(2)) : null,
      productiveHrs:   parseFloat(s.productiveHrs.toFixed(1)),
      totalLoggedHrs:  parseFloat(s.totalLoggedHrs.toFixed(1)),
      consistencyScore: parseFloat(s.consistencyScore.toFixed(1)),
    }));
  }

  // ─── Longest streak helper ────────────────────────────────────────────────
  private computeLongestStreak(entries: { date: Date }[]) {
    if (entries.length === 0) {
      return { days: 0, startDate: null, endDate: null };
    }

    const dates = [
      ...new Set(entries.map(e => e.date.toISOString().split('T')[0])),
    ].sort();

    let longest = 1;
    let current = 1;
    let longestEnd = dates[0];
    let longestStart = dates[0];
    let currentStart = dates[0];

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff =
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current++;
        if (current > longest) {
          longest = current;
          longestEnd = dates[i];
          longestStart = currentStart;
        }
      } else {
        current = 1;
        currentStart = dates[i];
      }
    }

    return {
      days: longest,
      startDate: longestStart,
      endDate: longestEnd,
    };
  }
}