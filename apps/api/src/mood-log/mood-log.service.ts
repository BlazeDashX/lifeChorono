import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

@Injectable()
export class MoodLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a mood log for today.
   * - date is always server-generated (client cannot spoof it)
   * - @@unique([userId, date]) enforces one log per user per calendar day
   * - Second submission on same day silently overwrites the first
   */
  async create(userId: string, dto: CreateMoodLogDto) {
    // Generate today's date in UTC as a plain date (no time component)
    // Stored as @db.Date — must be a midnight UTC DateTime
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return this.prisma.moodLog.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        score: dto.score,
        note: dto.note ?? null,
      },
      create: {
        userId,
        date: today,
        score: dto.score,
        note: dto.note ?? null,
      },
    });
  }

  /**
   * Get all mood logs for a user, newest first.
   * Used by AI context assembly and snapshot cron.
   */
  async findAllByUser(userId: string) {
    return this.prisma.moodLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get mood logs for a user within a date range (inclusive).
   * Used by weekly snapshot cron and AI insights context assembly.
   */
  async findByDateRange(userId: string, from: Date, to: Date) {
    return this.prisma.moodLog.findMany({
      where: {
        userId,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Get today's mood log for a user, or null if not yet logged.
   * Used by frontend to pre-populate the picker if already submitted today.
   */
  async findToday(userId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return this.prisma.moodLog.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });
  }
}