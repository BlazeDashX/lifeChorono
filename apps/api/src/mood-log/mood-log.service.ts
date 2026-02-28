import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

export interface TodayMoodSummary {
  avgScore: number;          // rounded to 1 decimal e.g. 3.7
  roundedScore: number;      // 1–5 integer for emoji mapping
  count: number;             // how many times logged today
  logs: {
    id: string;
    score: number;
    note: string | null;
    createdAt: string;
  }[];
}

@Injectable()
export class MoodLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append a new mood log for today.
   * No upsert — multiple logs per day are allowed.
   * Average is computed at read time.
   */
  async create(userId: string, dto: CreateMoodLogDto) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return this.prisma.moodLog.create({
      data: {
        userId,
        date: today,
        score: dto.score,
        note: dto.note ?? null,
      },
    });
  }

  /**
   * Get today's mood summary for a user.
   * Returns null if no logs exist for today.
   * Returns avgScore, roundedScore (for emoji), count, and all logs.
   */
  async getTodaySummary(userId: string): Promise<TodayMoodSummary | null> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const logs = await this.prisma.moodLog.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) return null;

    const avg = logs.reduce((sum, l) => sum + l.score, 0) / logs.length;
    const avgScore = Math.round(avg * 10) / 10; // 1 decimal place
    const roundedScore = Math.round(avg) as 1 | 2 | 3 | 4 | 5;

    return {
      avgScore,
      roundedScore: Math.min(5, Math.max(1, roundedScore)) as 1 | 2 | 3 | 4 | 5,
      count: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        score: l.score,
        note: l.note,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Get all mood logs for a user, newest first.
   * Used by AI context assembly and snapshot cron.
   */
  async findAllByUser(userId: string) {
    return this.prisma.moodLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get mood logs for a user within a date range (inclusive).
   * Returns per-day averages — used by weekly snapshot cron and AI insights.
   */
  async findDailyAveragesByRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ date: Date; avgScore: number }[]> {
    const logs = await this.prisma.moodLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    // Group by date string and average per day
    const byDate = new Map<string, number[]>();
    for (const log of logs) {
      const key = log.date.toISOString().split('T')[0];
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(log.score);
    }

    return Array.from(byDate.entries()).map(([dateStr, scores]) => ({
      date: new Date(dateStr),
      avgScore:
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }));
  }
}