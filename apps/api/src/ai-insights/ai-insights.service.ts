import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiInsightsService {
  private genAI: GoogleGenerativeAI;
  private lastAutoGenerate: Map<string, Date> = new Map();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.genAI = new GoogleGenerativeAI(this.config.get('GEMINI_API_KEY') || '');
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  async getEntriesForWeek(userId: string, weekStart: Date, weekEnd: Date) {
    return this.prisma.timeEntry.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { date: 'asc' },
    });
  }

  async analyzeUserMood(
    userId: string,
    entries: any[],
    weekStart: Date,
    weekEnd: Date,
  ) {
    const insights = await this.generateGeminiInsights(entries);

    return await this.prisma.aiInsight.create({
      data: {
        user: { connect: { id: userId } },
        weekStart,
        weekEnd,
        summary: insights.summary,
        balanceScore: insights.balanceScore,
        recommendations: insights.recommendations,
      },
    });
  }

  async getLatestInsights(userId: string) {
    return this.prisma.aiInsight.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      take: 4,
    });
  }

  // Current week insight for dashboard
  async getCurrentWeekInsight(userId: string) {
    const weekStart = this.getStartOfWeek(0);
    const weekEnd = this.getEndOfWeek(0);

    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart },
    });

    if (existing) return existing;

    const entries = await this.getEntriesForWeek(userId, weekStart, weekEnd);
    return this.analyzeUserMood(userId, entries, weekStart, weekEnd);
  }

  // Force regenerate current week insight
  async resetCurrentWeek(userId: string) {
    const weekStart = this.getStartOfWeek(0);

    await this.prisma.aiInsight.deleteMany({
      where: { userId, weekStart },
    });

    this.lastAutoGenerate.delete(userId);
    return this.getCurrentWeekInsight(userId);
  }

  // Get existing historical insights (weekly)
async getWeeklyHistory(userId: string) {
  const results: {
    weekStart: string;
    weekEnd: string;
    label: string;
    insight: Awaited<ReturnType<typeof this.prisma.aiInsight.findFirst>>;
  }[] = [];

  for (let i = 1; i <= 4; i++) {
    const weekStart = this.getStartOfWeek(-i);
    const weekEnd = this.getEndOfWeek(-i);
    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart },
    });
    results.push({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      insight: existing ?? null,
    });
  }

  return results;
}

  // Generate a specific past week insight on demand
  async generateWeekInsight(userId: string, weeksBack: number) {
    const weekStart = this.getStartOfWeek(-weeksBack);
    const weekEnd = this.getEndOfWeek(-weeksBack);

    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart },
    });

    if (existing) return existing;

    const entries = await this.getEntriesForWeek(userId, weekStart, weekEnd);
    return this.analyzeUserMood(userId, entries, weekStart, weekEnd);
  }

  // Get existing historical insights (monthly)
  
async getMonthlyHistory(userId: string) {
  const results: {
    monthStart: string;
    monthEnd: string;
    label: string;
    insight: Awaited<ReturnType<typeof this.prisma.aiInsight.findFirst>>;
  }[] = [];

  for (let i = 1; i <= 3; i++) {
    const monthStart = this.getStartOfMonth(-i);
    const monthEnd = this.getEndOfMonth(-i);
    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart: monthStart },
    });
    results.push({
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      insight: existing ?? null,
    });
  }

  return results;
}

  // Generate a specific past month insight on demand
  async generateMonthInsight(userId: string, monthsBack: number) {
    const monthStart = this.getStartOfMonth(-monthsBack);
    const monthEnd = this.getEndOfMonth(-monthsBack);

    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart: monthStart },
    });

    if (existing) return existing;

    const entries = await this.getEntriesForWeek(userId, monthStart, monthEnd);
    return this.analyzeUserMood(userId, entries, monthStart, monthEnd);
  }

  async testGeminiConnection() {
    const apiKey = this.config.get('GEMINI_API_KEY');
    if (!apiKey) return { connected: false, error: 'GEMINI_API_KEY is not set' };

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' } as any,
      });
      const result = await model.generateContent(
        'Return this exact JSON: {"status": "ok", "message": "Gemini is working"}',
      );
      const text = result.response.text();
      return {
        connected: true,
        model: 'gemini-2.5-flash',
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        parsed: JSON.parse(text),
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        isQuotaError: error?.message?.includes('429'),
      };
    }
  }

  // ─── Private: Gemini ─────────────────────────────────────────────────────

  private async generateGeminiInsights(entries: any[]) {
    if (!this.config.get('GEMINI_API_KEY')) {
      return this.fallbackAnalysis(entries);
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' } as any,
      });

      const userData = this.prepareUserDataForGemini(entries);

      const prompt = `
        You are an expert life coach and productivity analyst. Analyze this user's activity data and provide personalized insights.

        User Data:
        ${userData}

        Provide:
        1. A brief summary (2-3 sentences)
        2. A work-life balance score (0-100)
        3. 3 specific, actionable recommendations

        Respond in this exact JSON format:
        {
          "summary": "...",
          "balanceScore": 85,
          "recommendations": ["...", "...", "..."]
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in Gemini response');
      const insights = JSON.parse(jsonMatch[0]);

      if (
        !insights.summary ||
        insights.balanceScore === undefined ||
        !Array.isArray(insights.recommendations)
      ) {
        throw new Error('Gemini response missing required fields');
      }

      return {
        summary: String(insights.summary),
        balanceScore: Number(insights.balanceScore),
        recommendations: insights.recommendations as string[],
      };
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return this.fallbackAnalysis(entries);
    }
  }

  private prepareUserDataForGemini(entries: any[]): string {
    const totalHours = entries.reduce((sum, e) => sum + e.durationMinutes / 60, 0);
    const sleepEntries = entries.filter(
      (e) => e.category === 'restoration' && e.title.toLowerCase().includes('sleep'),
    );
    const productiveHours = entries
      .filter((e) => e.category === 'productive')
      .reduce((sum, e) => sum + e.durationMinutes / 60, 0);
    const leisureHours = entries
      .filter((e) => e.category === 'leisure')
      .reduce((sum, e) => sum + e.durationMinutes / 60, 0);
    const avgSleep =
      sleepEntries.length > 0
        ? sleepEntries.reduce((sum, e) => sum + e.durationMinutes / 60, 0) / sleepEntries.length
        : 0;
    const workRatioPct = totalHours > 0 ? ((productiveHours / totalHours) * 100).toFixed(1) : '0.0';

    return `
Total logged hours: ${totalHours.toFixed(1)}
Average sleep: ${avgSleep.toFixed(1)} hours
Productive hours: ${productiveHours.toFixed(1)}
Leisure hours: ${leisureHours.toFixed(1)}
Work ratio: ${workRatioPct}%
Daily breakdown:
${entries.map((e) => `- ${e.title} (${e.category}) - ${(e.durationMinutes / 60).toFixed(1)}h`).join('\n')}
    `.trim();
  }

  // ─── Private: Fallback ───────────────────────────────────────────────────

  private fallbackAnalysis(entries: any[]) {
    const totalHours = entries.reduce((sum, e) => sum + e.durationMinutes / 60, 0);
    const productiveHours = entries
      .filter((e) => e.category === 'productive')
      .reduce((sum, e) => sum + e.durationMinutes / 60, 0);
    const avgSleep = this.calculateAverageSleep(entries);
    const workRatio = totalHours > 0 ? productiveHours / totalHours : 0;

    const summaryParts: string[] = [];
    const recommendations: string[] = [];

    if (avgSleep < 6) {
      summaryParts.push('your sleep patterns show insufficient rest');
      recommendations.push('Prioritize 7-8 hours of sleep nightly for better recovery');
    } else if (avgSleep > 9) {
      summaryParts.push('your sleep duration is higher than average');
      recommendations.push('Monitor whether extended sleep is affecting your energy levels');
    } else {
      summaryParts.push('your sleep patterns look reasonable');
    }

    if (workRatio > 0.7) {
      summaryParts.push('you have high work intensity');
      recommendations.push('Schedule dedicated leisure and restoration time to avoid burnout');
    } else if (workRatio < 0.3) {
      summaryParts.push('your productive activity has been low');
      recommendations.push('Try time-blocking specific work sessions to improve focus');
    } else {
      summaryParts.push('your work-life balance looks healthy');
    }

    if (recommendations.length === 0) {
      recommendations.push('Keep up the good work — your balance looks solid');
    }

    return {
      summary: `This week, ${summaryParts.join(', and ')}. You logged ${totalHours.toFixed(1)} total hours.`,
      balanceScore: Math.round(100 - Math.abs(workRatio - 0.5) * 100),
      recommendations,
    };
  }

  private calculateAverageSleep(entries: any[]): number {
    const sleepEntries = entries.filter(
      (e) => e.category === 'restoration' && e.title.toLowerCase().includes('sleep'),
    );
    if (sleepEntries.length === 0) return 7;
    return sleepEntries.reduce((sum, e) => sum + e.durationMinutes / 60, 0) / sleepEntries.length;
  }

  // ─── Date Helpers ─────────────────────────────────────────────────────────

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

  private getStartOfMonth(monthsOffset: number = 0): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthsOffset, 1);
  }

  private getEndOfMonth(monthsOffset: number = 0): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthsOffset + 1, 0, 23, 59, 59, 999);
  }
}