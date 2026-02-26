import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getWeeklyDashboard(userId: string, weekStartString: string) {
    const weekStart = new Date(weekStartString);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // 7-day window

    // Fetch user goals and week's entries
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { weeklyGoals: true }
    });

    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } }
    });

    const breakdown = { productive: 0, leisure: 0, restoration: 0, neutral: 0 };
    let loggedMinutes = 0;

    const dailyBreakdown = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        productive: 0, leisure: 0, restoration: 0, neutral: 0
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

    // Calculate Streak
    const allEntries = await this.prisma.timeEntry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' }
    });
    
    const loggedDates = new Set(allEntries.map(e => e.date.toISOString().split('T')[0]));
    let streakDays = 0;
    let checkDate = new Date();
    
    // If today is missing, check yesterday to see if streak is still alive
    if (!loggedDates.has(checkDate.toISOString().split('T')[0])) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      totalHours: 168,
      loggedHours: loggedMinutes / 60,
      unloggedHours: 168 - (loggedMinutes / 60),
      breakdown,
      // Provide fallback default goals if empty
      goals: Object.keys(user?.weeklyGoals || {}).length ? user?.weeklyGoals : { productive: 40, leisure: 28, restoration: 56, neutral: 20 },
      dailyBreakdown,
      avgMoodScore: null, // Will be populated in Step 09
      streakDays,
    };
  }
}