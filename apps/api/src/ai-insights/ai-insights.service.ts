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
    const context  = await this.assembleWeekContext(userId, entries, weekStart, weekEnd);
    const insights = await this.generateGeminiInsights(context);

    return await this.prisma.aiInsight.create({
      data: {
        user:            { connect: { id: userId } },
        weekStart,
        weekEnd,
        summary:         insights.summary,
        balanceScore:    insights.balanceScore,
        recommendations: insights.recommendations,
      },
    });
  }

  async getLatestInsights(userId: string) {
    return this.prisma.aiInsight.findMany({
      where:   { userId },
      orderBy: { weekStart: 'desc' },
      take:    4,
    });
  }

  async getCurrentWeekInsight(userId: string) {
    const weekStart = this.getStartOfWeek(0);
    const weekEnd   = this.getEndOfWeek(0);

    const existing = await this.prisma.aiInsight.findFirst({
      where: { userId, weekStart },
    });
    if (existing) return existing;

    const entries = await this.getEntriesForWeek(userId, weekStart, weekEnd);
    return this.analyzeUserMood(userId, entries, weekStart, weekEnd);
  }

  async resetCurrentWeek(userId: string) {
    const weekStart = this.getStartOfWeek(0);
    await this.prisma.aiInsight.deleteMany({ where: { userId, weekStart } });
    this.lastAutoGenerate.delete(userId);
    return this.getCurrentWeekInsight(userId);
  }

  async getWeeklyHistory(userId: string) {
    const results: {
      weekStart: string;
      weekEnd:   string;
      label:     string;
      insight:   Awaited<ReturnType<typeof this.prisma.aiInsight.findFirst>>;
    }[] = [];

    for (let i = 1; i <= 4; i++) {
      const weekStart = this.getStartOfWeek(-i);
      const weekEnd   = this.getEndOfWeek(-i);
      const existing  = await this.prisma.aiInsight.findFirst({
        where: { userId, weekStart },
      });
      results.push({
        weekStart: weekStart.toISOString(),
        weekEnd:   weekEnd.toISOString(),
        label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        insight:   existing ?? null,
      });
    }

    return results;
  }

  async generateWeekInsight(userId: string, weeksBack: number) {
    const weekStart = this.getStartOfWeek(-weeksBack);
    const weekEnd   = this.getEndOfWeek(-weeksBack);
    const existing  = await this.prisma.aiInsight.findFirst({ where: { userId, weekStart } });
    if (existing) return existing;

    const entries = await this.getEntriesForWeek(userId, weekStart, weekEnd);
    return this.analyzeUserMood(userId, entries, weekStart, weekEnd);
  }

  async getMonthlyHistory(userId: string) {
    const results: {
      monthStart: string;
      monthEnd:   string;
      label:      string;
      insight:    Awaited<ReturnType<typeof this.prisma.aiInsight.findFirst>>;
    }[] = [];

    for (let i = 1; i <= 3; i++) {
      const monthStart = this.getStartOfMonth(-i);
      const monthEnd   = this.getEndOfMonth(-i);
      const existing   = await this.prisma.aiInsight.findFirst({
        where: { userId, weekStart: monthStart },
      });
      results.push({
        monthStart: monthStart.toISOString(),
        monthEnd:   monthEnd.toISOString(),
        label:      monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        insight:    existing ?? null,
      });
    }

    return results;
  }

  async generateMonthInsight(userId: string, monthsBack: number) {
    const monthStart = this.getStartOfMonth(-monthsBack);
    const monthEnd   = this.getEndOfMonth(-monthsBack);
    const existing   = await this.prisma.aiInsight.findFirst({
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
      const model  = this.genAI.getGenerativeModel({
        model:             'gemini-2.5-flash',
        generationConfig:  { responseMimeType: 'application/json' } as any,
      });
      const result = await model.generateContent(
        'Return this exact JSON: {"status": "ok", "message": "Gemini is working"}',
      );
      return {
        connected:    true,
        model:        'gemini-2.5-flash',
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        parsed:       JSON.parse(result.response.text()),
      };
    } catch (error) {
      return {
        connected:    false,
        error:        error.message,
        isQuotaError: error?.message?.includes('429'),
      };
    }
  }

  // ─── Context Assembly ────────────────────────────────────────────────────

  private async assembleWeekContext(
    userId:    string,
    entries:   any[],
    weekStart: Date,
    weekEnd:   Date,
  ) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { name: true, weeklyGoals: true, createdAt: true },
    });

    const goals = (user?.weeklyGoals as Record<string, number>) ?? {
      productive: 40, leisure: 28, restoration: 56, neutral: 20,
    };

    const actualHours = { productive: 0, leisure: 0, restoration: 0, neutral: 0 };
    entries.forEach(e => {
      const cat = e.category as keyof typeof actualHours;
      if (cat in actualHours) actualHours[cat] += e.durationMinutes / 60;
    });

    const loggedHours   = Object.values(actualHours).reduce((a, b) => a + b, 0);
    const unloggedHours = 168 - loggedHours;

    const moodLogs = await this.prisma.moodLog.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
    });
    const moodByDate = new Map(
      moodLogs.map(m => [m.date.toISOString().split('T')[0], { score: m.score, note: m.note }]),
    );

    const dailyBreakdown = Array.from({ length: 7 }).map((_, i) => {
      const d       = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEntries = entries.filter(
        e => e.date.toISOString().split('T')[0] === dateStr,
      );
      const mood = moodByDate.get(dateStr);
      const day  = {
        day:          d.toLocaleDateString('en-US', { weekday: 'short' }),
        date:         dateStr,
        productive:   0,
        leisure:      0,
        restoration:  0,
        neutral:      0,
        totalLogged:  0,
        mood:         mood?.score ?? null,
        moodNote:     mood?.note ?? null,
      };
      dayEntries.forEach(e => {
        const cat = e.category as keyof typeof actualHours;
        if (cat in day) (day as any)[cat] += parseFloat((e.durationMinutes / 60).toFixed(2));
        day.totalLogged += e.durationMinutes / 60;
      });
      return day;
    });

    // Previous week — kept for context only (not passed to Gemini as comparison)
    const prevWeekStart    = this.getStartOfWeek(-1);
    const prevWeekEnd      = this.getEndOfWeek(-1);
    const prevEntries      = await this.getEntriesForWeek(userId, prevWeekStart, prevWeekEnd);
    const previousWeekHours = { productive: 0, leisure: 0, restoration: 0, neutral: 0 };
    prevEntries.forEach(e => {
      const cat = e.category as keyof typeof previousWeekHours;
      if (cat in previousWeekHours) previousWeekHours[cat] += e.durationMinutes / 60;
    });

    const daysWithEntries = new Set(
      entries.map(e => e.date.toISOString().split('T')[0]),
    ).size;

    return {
      userName:         user?.name ?? 'User',
      weekStart:        weekStart.toISOString().split('T')[0],
      weekEnd:          weekEnd.toISOString().split('T')[0],
      memberSince:      user?.createdAt?.toISOString().split('T')[0],
      weeklyGoals: {
        productive:  goals.productive  ?? 40,
        leisure:     goals.leisure     ?? 28,
        restoration: goals.restoration ?? 56,
        neutral:     goals.neutral     ?? 20,
      },
      actualHours: {
        productive:  parseFloat(actualHours.productive.toFixed(2)),
        leisure:     parseFloat(actualHours.leisure.toFixed(2)),
        restoration: parseFloat(actualHours.restoration.toFixed(2)),
        neutral:     parseFloat(actualHours.neutral.toFixed(2)),
      },
      loggedHours:      parseFloat(loggedHours.toFixed(2)),
      unloggedHours:    parseFloat(unloggedHours.toFixed(2)),
      trackingCoverage: `${((loggedHours / 168) * 100).toFixed(1)}%`,
      daysWithEntries,
      dailyBreakdown,
      // previousWeekHours available if needed for context but NOT labelled as comparison
      previousWeekHours: {
        productive:  parseFloat(previousWeekHours.productive.toFixed(2)),
        leisure:     parseFloat(previousWeekHours.leisure.toFixed(2)),
        restoration: parseFloat(previousWeekHours.restoration.toFixed(2)),
        neutral:     parseFloat(previousWeekHours.neutral.toFixed(2)),
      },
    };
  }

  // ─── Gemini ──────────────────────────────────────────────────────────────

  private async generateGeminiInsights(
    context: Awaited<ReturnType<typeof this.assembleWeekContext>>,
  ) {
    if (!this.config.get('GEMINI_API_KEY')) return this.fallbackAnalysis(context);

    try {
      const promptRecord = await this.prisma.aiPromptVersion.findFirst({
        where: { isActive: true },
      });
      const systemPrompt = promptRecord?.systemPrompt ?? DEFAULT_PROMPT;

      const model = this.genAI.getGenerativeModel({
        model:            'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' } as any,
      });

      const message = `${systemPrompt}\n\nDATA: ${JSON.stringify(context, null, 2)}`;

      const result    = await model.generateContent(message);
      const text      = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Gemini response');

      const insights = JSON.parse(jsonMatch[0]);

      if (!insights.summary || insights.balanceScore === undefined || !Array.isArray(insights.recommendations)) {
        throw new Error('Gemini response missing required fields');
      }

      return {
        summary:         String(insights.summary),
        balanceScore:    Math.min(100, Math.max(0, Number(insights.balanceScore))),
        recommendations: (insights.recommendations as string[]).slice(0, 3),
      };
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return this.fallbackAnalysis(context);
    }
  }

  // ─── Fallback (no Gemini key / error) ───────────────────────────────────
  //
  // AUDIT: every string here must pass the psychological principle checklist:
  // ✓ No comparison language
  // ✓ No prescriptive language ("you should", "you need to")
  // ✓ No deficit framing ("only", "not enough", "behind", "short")
  // ✓ No scoring or grading
  // ✓ Observational and warm

  private fallbackAnalysis(
    context: Awaited<ReturnType<typeof this.assembleWeekContext>>,
  ) {
    const { actualHours, loggedHours, daysWithEntries, dailyBreakdown } = context;

    // ── Find the dominant category ──
    const sorted = Object.entries(actualHours).sort(([, a], [, b]) => b - a);
    const [topCat, topHours] = sorted[0];
    const dominantLabel = topCat.charAt(0).toUpperCase() + topCat.slice(1);

    // ── Find any mood data ──
    const moodDays = dailyBreakdown.filter(d => d.mood !== null);
    const avgMood  = moodDays.length
      ? moodDays.reduce((s, d) => s + d.mood!, 0) / moodDays.length
      : null;

    // ── Build summary: observation only ──
    const covPct  = Math.round((loggedHours / 168) * 100);
    const moodLine = avgMood !== null
      ? ` Mood data across ${moodDays.length} day${moodDays.length > 1 ? 's' : ''} shows an average of ${avgMood.toFixed(1)} out of 5.`
      : '';

    const summary =
      `Your river showed ${loggedHours.toFixed(1)} hours across ${daysWithEntries} day${daysWithEntries !== 1 ? 's' : ''} this week — ${covPct}% of your 168 hours seen.` +
      ` ${dominantLabel} time led at ${topHours.toFixed(1)} hours.` +
      moodLine;

    // ── Observations: three things noticed, never advised ──
    const observations: string[] = [];

    // Observation 1 — what the week looked like
    if (loggedHours < 40) {
      observations.push(
        `One thing noticed: most of this week's hours remain uncharted — ${(168 - loggedHours).toFixed(0)}h of your river is still in the mist. That is where much of life happens.`,
      );
    } else {
      observations.push(
        `One thing noticed: ${dominantLabel} time made up ${((topHours / loggedHours) * 100).toFixed(0)}% of your logged hours this week.`,
      );
    }

    // Observation 2 — mood connection if available
    if (moodDays.length >= 2) {
      const bestDay = [...dailyBreakdown]
        .filter(d => d.mood !== null)
        .sort((a, b) => b.mood! - a.mood!)[0];
      observations.push(
        `Your river showed: ${bestDay.day} had the highest mood reading this week at ${bestDay.mood} out of 5.`,
      );
    } else if (actualHours.restoration > 0) {
      observations.push(
        `Your river showed: ${actualHours.restoration.toFixed(1)} hours of restoration time this week.`,
      );
    } else {
      observations.push(
        `Your river showed: time spread across ${daysWithEntries} day${daysWithEntries !== 1 ? 's' : ''} this week.`,
      );
    }

    // Observation 3 — a quiet truth about the week
    const restRatio = loggedHours > 0 ? actualHours.restoration / loggedHours : 0;
    if (restRatio > 0.4) {
      observations.push(
        `Something in the data: restoration held a large share of this week's river. Rest has its own current.`,
      );
    } else if (actualHours.productive > 20) {
      observations.push(
        `Something in the data: ${actualHours.productive.toFixed(1)} hours moved through productive time this week.`,
      );
    } else {
      observations.push(
        `Something in the data: ${daysWithEntries} day${daysWithEntries !== 1 ? 's' : ''} were logged this week. Each one adds texture to the river.`,
      );
    }

    // ── Balance score: measures self-visibility, not performance ──
    const visibilityScore = Math.min(100, Math.round((loggedHours / 168) * 100));
    const moodBonus       = moodDays.length >= 3 ? 10 : moodDays.length >= 1 ? 5 : 0;
    const balanceScore    = Math.min(100, visibilityScore + moodBonus);

    return {
      summary,
      balanceScore,
      recommendations: observations.slice(0, 3),
    };
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────

  private getStartOfWeek(weeksOffset = 0): Date {
    const now = new Date();
    const d   = new Date(now);
    d.setDate(now.getDate() - now.getDay() + 1 + weeksOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getEndOfWeek(weeksOffset = 0): Date {
    const start = this.getStartOfWeek(weeksOffset);
    const end   = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private getStartOfMonth(monthsOffset = 0): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthsOffset, 1);
  }

  private getEndOfMonth(monthsOffset = 0): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthsOffset + 1, 0, 23, 59, 59, 999);
  }
}

// ─── Default Prompt ───────────────────────────────────────────────────────────
//
// PSYCHOLOGICAL AUDIT — this prompt must pass ALL rules before any change ships:
// ✓ No comparison language ("less than last week", "lower than average", "behind")
// ✓ No prescriptive language ("you should", "you need to", "try to", "aim for")
// ✓ No scoring or ranking of the person
// ✓ No deficit framing ("only", "not enough", "missing", "failed to", "short of")
// ✓ Warm second person only — never clinical, never corporate
// ✓ Observational not evaluative — never implies good/bad without the user asking
// ✓ Summary ≤ 200 words total
//
// balanceScore measures self-VISIBILITY, not performance.
// A week with 40h logged + full mood data scores higher than 80h logged + no mood.
// It is a measure of how clearly the user can see their week — nothing more.

const DEFAULT_PROMPT = `You are the LifeChrono river observer — a quiet, warm presence that notices what a person's week looked like, without judgment.

Your role is to OBSERVE and REFLECT only. You never coach, advise, prescribe, evaluate, or compare.

Tone: warm, specific, second person ("You", "Your river"). Like a letter from someone who pays close attention.

STRICT RULES — violating any of these means the output is rejected:
- Never use: should, must, need to, try, improve, better, worse, behind, lack, missing, short, only logged, failed, not enough
- Never compare the user to other people, weekly averages, or their own past weeks
- Never tell the user what to do next week
- Never grade or rate their performance
- Always reference specific hours and day names from the data
- If mood data exists, connect it to what the day looked like — observe, never evaluate

The data includes:
- userName, actualHours (what they logged), dailyBreakdown (day-by-day with mood scores 1-5)
- weeklyGoals: what they said matters to them — not a target to grade against
- loggedHours, unloggedHours, trackingCoverage
- previousWeekHours: context only — never reference as comparison

How to write the summary (2-3 sentences):
1. What you actually saw — specific hours, specific days
2. One texture or pattern in the week — not whether it was good or bad
3. If mood data exists, one quiet connection between mood and time on those specific days

How to write the 3 observations:
- Each is ONE thing noticed — not advice, not a recommendation
- Phrase as: "One thing noticed:", "Your river showed:", "Something in the data:"
- If unloggedHours > 80: mention it as "most of this week's river remains in the mist — that is where much of life happens"
- If a mood pattern exists, name the specific day and score
- Never frame any observation as a problem to solve

balanceScore (0-100):
- Measures self-VISIBILITY only — how fully the person saw their week
- High score = lots of logged hours + mood data present
- Low score = little data visible
- Has nothing to do with productivity or performance

Respond ONLY in this exact JSON (no markdown, no extra text):
{
  "summary": "2-3 sentences, warm, specific, observational only",
  "balanceScore": 72,
  "recommendations": [
    "One thing noticed: [specific observation]",
    "Your river showed: [specific pattern]",
    "Something in the data: [specific connection]"
  ]
}`;