import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Cron: Every Sunday at 00:00 UTC ─────────────────────────────────────
  @Cron('0 0 * * 0')
  async computeWeeklySnapshots() {
    this.logger.log('Running weekly snapshot cron...');

    const weekStart = this.getStartOfWeek();
    const weekEnd = this.getEndOfWeek();

    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    let success = 0;
    let failed = 0;

    for (const { id: userId } of users) {
      try {
        await this.computeSnapshotForUser(userId, weekStart, weekEnd);
        success++;
      } catch (err) {
        this.logger.error(`Snapshot failed for user ${userId}: ${err.message}`);
        failed++;
      }
    }

    this.logger.log(
      `Weekly snapshots done — ${success} success, ${failed} failed`,
    );

    return { success, failed, weekStart, weekEnd };
  }

  // ─── Manual trigger (admin / dev) ────────────────────────────────────────
  async forceComputeSnapshots(weeksBack: number = 0) {
    this.logger.log(`Force computing snapshots for weeksBack=${weeksBack}`);

    const weekStart = this.getStartOfWeek(-weeksBack);
    const weekEnd = this.getEndOfWeek(-weeksBack);

    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    let success = 0;
    let failed = 0;

    for (const { id: userId } of users) {
      try {
        await this.computeSnapshotForUser(userId, weekStart, weekEnd);
        success++;
      } catch (err) {
        this.logger.error(`Snapshot failed for user ${userId}: ${err.message}`);
        failed++;
      }
    }

    return { success, failed, weekStart, weekEnd };
  }

  // ─── Single user snapshot ─────────────────────────────────────────────────
  async computeSnapshotForUser(
    userId: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    });

    const moods = await this.prisma.moodLog.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    });

    const snapshot = this.aggregateSnapshot(
      entries,
      moods,
      userId,
      weekStart,
    );

    return this.prisma.weeklySnapshot.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      update: snapshot,
      create: { ...snapshot, userId, weekStart },
    });
  }

  // ─── Aggregation ──────────────────────────────────────────────────────────
  private aggregateSnapshot(
    entries: any[],
    moods: any[],
    userId: string,
    weekStart: Date,
  ) {
    // Hours per category
    const productiveHrs = this.sumHours(entries, 'productive');
    const leisureHrs    = this.sumHours(entries, 'leisure');
    const restorationHrs= this.sumHours(entries, 'restoration');
    const neutralHrs    = this.sumHours(entries, 'neutral');
    const totalLoggedHrs = productiveHrs + leisureHrs + restorationHrs + neutralHrs;

    // Avg mood score
    const avgMoodScore =
      moods.length > 0
        ? moods.reduce((sum, m) => sum + m.score, 0) / moods.length
        : null;

    // Consistency score — % of days in the week that have at least one entry
    const daysWithEntries = new Set(
      entries.map(e => e.date.toISOString().split('T')[0]),
    ).size;
    const consistencyScore = parseFloat(((daysWithEntries / 7) * 100).toFixed(2));

    return {
      productiveHrs:   parseFloat(productiveHrs.toFixed(2)),
      leisureHrs:      parseFloat(leisureHrs.toFixed(2)),
      restorationHrs:  parseFloat(restorationHrs.toFixed(2)),
      neutralHrs:      parseFloat(neutralHrs.toFixed(2)),
      totalLoggedHrs:  parseFloat(totalLoggedHrs.toFixed(2)),
      avgMoodScore:    avgMoodScore ? parseFloat(avgMoodScore.toFixed(2)) : null,
      consistencyScore,
    };
  }

  private sumHours(entries: any[], category: string): number {
    return entries
      .filter(e => e.category === category)
      .reduce((sum, e) => sum + e.durationMinutes / 60, 0);
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────
  private getStartOfWeek(weeksOffset: number = 0): Date {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + 1 + weeksOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getEndOfWeek(weeksOffset: number = 0): Date {
    const start = this.getStartOfWeek(weeksOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}