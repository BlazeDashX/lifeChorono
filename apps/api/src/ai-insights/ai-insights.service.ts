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
    // ── Assemble full context for Gemini ──────────────────────────────────
    const context = await this.assembleWeekContext(
      userId,
      entries,
      weekStart,
      weekEnd,
    );

    const insights = await this.generateGeminiInsights(context);

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

  async resetCurrentWeek(userId: string) {
    const weekStart = this.getStartOfWeek(0);

    await this.prisma.aiInsight.deleteMany({
      where: { userId, weekStart },
    });

    this.lastAutoGenerate.delete(userId);
    return this.getCurrentWeekInsight(userId);
  }

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

  // ─── Context Assembly ────────────────────────────────────────────────────

  private async assembleWeekContext(
    userId: string,
    entries: any[],
    weekStart: Date,
    weekEnd: Date,
  ) {
    // ── User info + goals ──
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, weeklyGoals: true, createdAt: true },
    });

    const goals = (user?.weeklyGoals as Record<string, number>) ?? {
      productive: 40,
      leisure: 28,
      restoration: 56,
      neutral: 20,
    };

    // ── Actual hours this week ──
    const actualHours = {
      productive: 0,
      leisure: 0,
      restoration: 0,
      neutral: 0,
    };

    entries.forEach(e => {
      const cat = e.category as keyof typeof actualHours;
      if (cat in actualHours) {
        actualHours[cat] += e.durationMinutes / 60;
      }
    });

    const loggedHours = Object.values(actualHours).reduce((a, b) => a + b, 0);
    const unloggedHours = 168 - loggedHours;

    // ── Daily breakdown with mood ──
    const moodLogs = await this.prisma.moodLog.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    });

    const moodByDate = new Map(
      moodLogs.map(m => [
        m.date.toISOString().split('T')[0],
        { score: m.score, note: m.note },
      ]),
    );

    const dailyBreakdown = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEntries = entries.filter(
        e => e.date.toISOString().split('T')[0] === dateStr,
      );
      const mood = moodByDate.get(dateStr);

      const day = {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        productive: 0,
        leisure: 0,
        restoration: 0,
        neutral: 0,
        totalLogged: 0,
        mood: mood?.score ?? null,
        moodNote: mood?.note ?? null,
      };

      dayEntries.forEach(e => {
        const cat = e.category as keyof typeof actualHours;
        if (cat in day) {
          (day as any)[cat] += parseFloat((e.durationMinutes / 60).toFixed(2));
        }
        day.totalLogged += e.durationMinutes / 60;
      });

      return day;
    });

    // ── Previous week hours for comparison ──
    const prevWeekStart = this.getStartOfWeek(-1);
    const prevWeekEnd = this.getEndOfWeek(-1);
    const prevEntries = await this.getEntriesForWeek(
      userId,
      prevWeekStart,
      prevWeekEnd,
    );

    const previousWeekHours = {
      productive: 0,
      leisure: 0,
      restoration: 0,
      neutral: 0,
    };

    prevEntries.forEach(e => {
      const cat = e.category as keyof typeof previousWeekHours;
      if (cat in previousWeekHours) {
        previousWeekHours[cat] += e.durationMinutes / 60;
      }
    });

    // ── Streak ──
    const allEntries = await this.prisma.timeEntry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' },
    });

    const loggedDates = new Set(
      allEntries.map(e => e.date.toISOString().split('T')[0]),
    );

    let streakDays = 0;
    let checkDate = new Date();
    const todayStr = checkDate.toISOString().split('T')[0];

    if (!loggedDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // ── Days logged this week ──
    const daysWithEntries = new Set(
      entries.map(e => e.date.toISOString().split('T')[0]),
    ).size;

    return {
      userName: user?.name ?? 'User',
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      memberSince: user?.createdAt?.toISOString().split('T')[0],
      weeklyGoals: {
        productive: goals.productive ?? 40,
        leisure: goals.leisure ?? 28,
        restoration: goals.restoration ?? 56,
        neutral: goals.neutral ?? 20,
      },
      actualHours: {
        productive: parseFloat(actualHours.productive.toFixed(2)),
        leisure: parseFloat(actualHours.leisure.toFixed(2)),
        restoration: parseFloat(actualHours.restoration.toFixed(2)),
        neutral: parseFloat(actualHours.neutral.toFixed(2)),
      },
      goalDiff: {
        productive: parseFloat((actualHours.productive - (goals.productive ?? 40)).toFixed(2)),
        leisure: parseFloat((actualHours.leisure - (goals.leisure ?? 28)).toFixed(2)),
        restoration: parseFloat((actualHours.restoration - (goals.restoration ?? 56)).toFixed(2)),
        neutral: parseFloat((actualHours.neutral - (goals.neutral ?? 20)).toFixed(2)),
      },
      loggedHours: parseFloat(loggedHours.toFixed(2)),
      unloggedHours: parseFloat(unloggedHours.toFixed(2)),
      trackingCoverage: `${((loggedHours / 168) * 100).toFixed(1)}%`,
      daysWithEntries,
      dailyBreakdown,
      previousWeekHours: {
        productive: parseFloat(previousWeekHours.productive.toFixed(2)),
        leisure: parseFloat(previousWeekHours.leisure.toFixed(2)),
        restoration: parseFloat(previousWeekHours.restoration.toFixed(2)),
        neutral: parseFloat(previousWeekHours.neutral.toFixed(2)),
      },
      weekOverWeekChange: {
        productive: parseFloat((actualHours.productive - previousWeekHours.productive).toFixed(2)),
        leisure: parseFloat((actualHours.leisure - previousWeekHours.leisure).toFixed(2)),
        restoration: parseFloat((actualHours.restoration - previousWeekHours.restoration).toFixed(2)),
        neutral: parseFloat((actualHours.neutral - previousWeekHours.neutral).toFixed(2)),
      },
      streakDays,
    };
  }

  // ─── Private: Gemini ─────────────────────────────────────────────────────

  private async generateGeminiInsights(context: Awaited<ReturnType<typeof this.assembleWeekContext>>) {
    if (!this.config.get('GEMINI_API_KEY')) {
      return this.fallbackAnalysis(context);
    }

    try {
      // ── Fetch active prompt from DB, fall back to default ──
      const promptRecord = await this.prisma.aiPromptVersion.findFirst({
        where: { isActive: true },
      });

      const systemPrompt = promptRecord?.systemPrompt ?? DEFAULT_PROMPT;

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' } as any,
      });

      const message = `${systemPrompt}

DATA: ${JSON.stringify(context, null, 2)}

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "summary": "2-3 sentence summary referencing specific numbers",
  "balanceScore": 75,
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2", 
    "Specific recommendation 3"
  ]
}`;

      const result = await model.generateContent(message);
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
        balanceScore: Math.min(100, Math.max(0, Number(insights.balanceScore))),
        recommendations: insights.recommendations.slice(0, 3) as string[],
      };
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return this.fallbackAnalysis(context);
    }
  }

  // ─── Private: Fallback ───────────────────────────────────────────────────

  private fallbackAnalysis(
    context: Awaited<ReturnType<typeof this.assembleWeekContext>>,
  ) {
    const { actualHours, loggedHours, weeklyGoals, streakDays, daysWithEntries } = context;

    const summaryParts: string[] = [];
    const recommendations: string[] = [];

    const workRatio = loggedHours > 0 ? actualHours.productive / loggedHours : 0;
    const productiveDiff = actualHours.productive - weeklyGoals.productive;
    const restorationDiff = actualHours.restoration - weeklyGoals.restoration;

    // Productive
    if (productiveDiff >= 0) {
      summaryParts.push(
        `you hit your productive goal (${actualHours.productive.toFixed(1)}h vs ${weeklyGoals.productive}h target)`,
      );
    } else {
      summaryParts.push(
        `you logged ${actualHours.productive.toFixed(1)}h of productive time, ${Math.abs(productiveDiff).toFixed(1)}h short of your ${weeklyGoals.productive}h goal`,
      );
      recommendations.push(
        `Block ${Math.ceil(Math.abs(productiveDiff) / 5)}h daily for focused work to hit your ${weeklyGoals.productive}h productive goal next week`,
      );
    }

    // Restoration
    if (restorationDiff < -5) {
      summaryParts.push(
        `restoration was low at ${actualHours.restoration.toFixed(1)}h vs your ${weeklyGoals.restoration}h target`,
      );
      recommendations.push(
        `Add ${Math.ceil(Math.abs(restorationDiff) / 7)}h of sleep or rest daily — you're ${Math.abs(restorationDiff).toFixed(1)}h behind on restoration`,
      );
    }

    // Tracking coverage
    const coverage = (loggedHours / 168) * 100;
    if (coverage < 50) {
      summaryParts.push(
        `${(168 - loggedHours).toFixed(1)} hours are untracked this week`,
      );
      recommendations.push(
        `You only tracked ${coverage.toFixed(0)}% of your week — log activities for at least ${7 - daysWithEntries} more days for better insights`,
      );
    }

    // Streak
    if (streakDays >= 3) {
      summaryParts.push(`you're on a ${streakDays}-day logging streak`);
    }

    // Fill recommendations to 3
    if (recommendations.length === 0) {
      recommendations.push('Your balance looks solid — keep maintaining this pattern next week');
    }
    while (recommendations.length < 3) {
      if (actualHours.leisure < weeklyGoals.leisure) {
        recommendations.push(
          `Schedule ${(weeklyGoals.leisure - actualHours.leisure).toFixed(1)}h more leisure — you logged only ${actualHours.leisure.toFixed(1)}h vs your ${weeklyGoals.leisure}h goal`,
        );
      } else {
        recommendations.push(
          `You logged ${loggedHours.toFixed(1)}h total — aim to track at least 120h next week for full visibility`,
        );
      }
      if (recommendations.length >= 3) break;
    }

    const balanceScore = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          100 -
            Math.abs(productiveDiff) * 1.5 -
            Math.max(0, -restorationDiff) * 1.0 -
            Math.max(0, 50 - coverage) * 0.5,
        ),
      ),
    );

    return {
      summary: `This week, ${summaryParts.slice(0, 2).join(', and ')}. You logged ${loggedHours.toFixed(1)}h across ${daysWithEntries} days.`,
      balanceScore,
      recommendations: recommendations.slice(0, 3),
    };
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
    return new Date(
      now.getFullYear(),
      now.getMonth() + monthsOffset + 1,
      0,
      23,
      59,
      59,
      999,
    );
  }
}

// ─── Default Prompt ───────────────────────────────────────────────────────────

const DEFAULT_PROMPT = `You are LifeChrono AI — a personal productivity coach.
Tone: direct, warm, specific. Gen-Z friendly. Never corporate.

You receive a user's full week of time tracking data as JSON. Your job is to analyze
patterns, connect mood scores to time usage, and give actionable advice for NEXT week.

The data includes:
- userName: who you're talking to
- weeklyGoals: their targets per category
- actualHours: what they actually logged
- goalDiff: how far above/below each goal (positive = over, negative = under)
- dailyBreakdown: day by day with mood scores (1-5) and notes
- previousWeekHours: last week's actuals for comparison
- weekOverWeekChange: delta vs last week per category
- trackingCoverage: what % of the 168hr week was logged
- streakDays: consecutive days logged

Rules:
- ALWAYS reference specific numbers from the data — hours, percentages, day names
- If mood scores exist, connect them to the time patterns on those days
- If goalDiff is negative for productive: address it directly and specifically
- If unloggedHours > 50 (trackingCoverage < 70%): mention the tracking gap first
- If weekOverWeekChange shows improvement: acknowledge it with the specific number
- If streakDays >= 7: acknowledge the consistency
- Never give generic advice like "take breaks" or "sleep more" — be specific to their numbers
- Compare to previous week whenever the data shows a meaningful change (>2h difference)

Respond ONLY in this JSON format (no markdown, no extra text):
{
  "summary": "2-3 sentences that feel personal, reference their name and specific hours",
  "balanceScore": 75,
  "recommendations": [
    "Specific rec referencing their actual numbers",
    "Specific rec referencing their actual numbers",
    "Specific rec referencing their actual numbers"
  ]
}`;