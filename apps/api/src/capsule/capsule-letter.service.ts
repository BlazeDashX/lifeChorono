import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { MoodNarrativeService } from './mood-narrative.service';

// ── Milestone schedule — days after signup ────────────────────────────────────
const SCHEDULE: { type: string; days: number }[] = [
  { type: 'three_month', days: 91  },
  { type: 'six_month',   days: 182 },
  { type: 'one_year',    days: 365 },
  { type: 'two_year',    days: 730 },
];

// ── Subject lines per type ────────────────────────────────────────────────────
const SUBJECTS: Record<string, string[]> = {
  three_month: [
    'A letter from your past self',
    'Three months ago, you wrote something',
    'Your river has something to show you',
  ],
  six_month: [
    'Six months of your river',
    'Half a year. Your river remembers.',
    'Something shifted. Here is what we saw.',
  ],
  one_year: [
    'One year in the river',
    'A year of your life, held in the river',
    'Your river remembers everything.',
  ],
  two_year: [
    'Two years on the river',
    'Who you were. Who you became.',
    'Two years of your river.',
  ],
};

@Injectable()
export class CapsuleLetterService {
  private readonly logger = new Logger(CapsuleLetterService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly prisma:    PrismaService,
    private readonly config:    ConfigService,
    private readonly moodSvc:   MoodNarrativeService,
  ) {
    this.genAI = new GoogleGenerativeAI(this.config.get('GEMINI_API_KEY') || '');
  }

  // ─── Cron: daily at 08:00 UTC ─────────────────────────────────────────────
  // Scans all users, fires generation for anyone who crosses a milestone today.

  @Cron('0 8 * * *')
  async dailyCapsuleCheck() {
    this.logger.log('Daily capsule check starting…');

    const users = await this.prisma.user.findMany({
      select: { id: true, createdAt: true },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let triggered = 0;

    for (const user of users) {
      const signup = new Date(user.createdAt);
      signup.setUTCHours(0, 0, 0, 0);

      const daysOld = Math.round(
        (today.getTime() - signup.getTime()) / 86_400_000,
      );

      for (const milestone of SCHEDULE) {
        if (daysOld === milestone.days) {
          const exists = await this.prisma.capsuleLetter.findFirst({
            where: { userId: user.id, type: milestone.type as any },
          });
          if (!exists) {
            // Fire and forget — errors logged internally
            this.generateAndStore(user.id, milestone.type, signup, today)
              .catch(err =>
                this.logger.error(
                  `Letter generation failed for ${user.id}: ${err.message}`,
                ),
              );
            triggered++;
          }
        }
      }
    }

    this.logger.log(`Daily capsule check complete. ${triggered} letter(s) triggered.`);
  }

  // ─── Core: generate one letter and store it ──────────────────────────────

  async generateAndStore(
    userId:       string,
    type:         string,
    signupDate:   Date,
    referenceDate: Date,
  ): Promise<void> {
    this.logger.log(`Generating ${type} letter for user ${userId}`);

    // ── 1. Sealed answers ──
    const answers = await this.prisma.timeCapsuleAnswers.findUnique({
      where: { userId },
    });

    // ── 2. River data across the window ──
    const hours = { productive: 0, leisure: 0, restoration: 0, neutral: 0 };
    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: signupDate, lte: referenceDate } },
      select: { category: true, durationMinutes: true },
    });
    for (const e of entries) {
      const cat = e.category as keyof typeof hours;
      if (cat in hours) hours[cat] += e.durationMinutes / 60;
    }
    const totalLogged = Object.values(hours).reduce((a, b) => a + b, 0);
    const totalDays   = Math.round(
      (referenceDate.getTime() - signupDate.getTime()) / 86_400_000,
    );

    // ── 3. User name ──
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { name: true },
    });
    const userName = user?.name ?? 'Friend';

    // ── 4. Mood narrative ──
    const mood = await this.moodSvc.build(userId, signupDate, referenceDate);

    // ── 5. Pick subject line ──
    const options = SUBJECTS[type] ?? SUBJECTS.three_month;
    const subject = options[Math.floor(Math.random() * options.length)];

    // ── 6. Generate body ──
    const body = await this.generateBody({
      type, userName, answers, hours, totalLogged,
      totalDays, mood, signupDate,
    });

    // ── 7. Store ──
    await this.prisma.capsuleLetter.create({
      data: {
        userId,
        type:    type as any,
        subject,
        body,
        moodArc: mood.narrative,
      },
    });

    this.logger.log(`${type} letter stored for user ${userId}`);
  }

  // ─── Gemini generation ───────────────────────────────────────────────────

  private async generateBody(ctx: {
    type:        string;
    userName:    string;
    answers:     { whoAreYou: string; whoWillYou: string } | null;
    hours:       { productive: number; leisure: number; restoration: number; neutral: number };
    totalLogged: number;
    totalDays:   number;
    mood:        Awaited<ReturnType<MoodNarrativeService['build']>>;
    signupDate:  Date;
  }): Promise<string> {
    if (!this.config.get('GEMINI_API_KEY')) {
      return this.fallbackBody(ctx);
    }

    try {
      const model  = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(buildPrompt(ctx));
      const text   = result.response.text().trim();
      if (!text || text.startsWith('{')) throw new Error('Unexpected output format');
      return text;
    } catch (err) {
      this.logger.warn(`Gemini failed, using fallback: ${err.message}`);
      return this.fallbackBody(ctx);
    }
  }

  // ─── Fallback body (no API key or Gemini error) ──────────────────────────
  //
  // Must pass the same psychological audit rules as the Gemini prompt:
  // ✓ No prescriptive language  ✓ No deficit framing
  // ✓ Observational only        ✓ Warm second person
  // ✓ Under 250 words

  private fallbackBody(ctx: {
    userName:    string;
    answers:     { whoAreYou: string; whoWillYou: string } | null;
    hours:       { productive: number; leisure: number; restoration: number; neutral: number };
    totalLogged: number;
    totalDays:   number;
    mood:        Awaited<ReturnType<MoodNarrativeService['build']>>;
    signupDate:  Date;
  }): string {
    const { userName, answers, hours, totalLogged, totalDays, mood, signupDate } = ctx;

    const dateLabel = signupDate.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const dominant = Object.entries(hours).sort(([, a], [, b]) => b - a)[0][0];
    const lines: string[] = [];

    lines.push(`${userName},`);
    lines.push('');

    if (answers?.whoAreYou) {
      lines.push(`On ${dateLabel}, you wrote this:`);
      lines.push('');
      lines.push(`"${answers.whoAreYou}"`);
      lines.push('');
    }

    if (answers?.whoWillYou) {
      lines.push(`You also wrote:`);
      lines.push('');
      lines.push(`"${answers.whoWillYou}"`);
      lines.push('');
    }

    lines.push(`Here is what your river showed.`);
    lines.push('');
    lines.push(
      `${totalLogged.toFixed(0)} hours were logged across ${totalDays} days. ` +
      `${dominant.charAt(0).toUpperCase() + dominant.slice(1)} time ran longest.`,
    );

    if (mood.totalDaysLogged >= 5) {
      lines.push('');
      lines.push(mood.narrative);
    }

    lines.push('');
    lines.push(
      `Only you know whether you became who you hoped to be. ` +
      `But your river looks different from when you first wrote those words. ` +
      `That is not nothing.`,
    );

    lines.push('');
    lines.push(`One question for the months ahead:`);
    lines.push('');
    lines.push(`What do you want to understand about yourself that you still don't?`);
    lines.push('');
    lines.push(`— Your River`);

    return lines.join('\n');
  }

  // ─── Public read API ─────────────────────────────────────────────────────

  /** All letters for a user, newest first */
  async getLetters(userId: string) {
    return this.prisma.capsuleLetter.findMany({
      where:   { userId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id:          true,
        type:        true,
        subject:     true,
        body:        true,
        moodArc:     true,
        generatedAt: true,
        readAt:      true,
      },
    });
  }

  /**
   * The oldest unread letter — null if none.
   * Frontend calls this on app load to know whether to show the letter view.
   */
  async getUnreadLetter(userId: string) {
    return this.prisma.capsuleLetter.findFirst({
      where:   { userId, readAt: null },
      orderBy: { generatedAt: 'asc' },
    });
  }

  /** Mark one letter as read */
  async markRead(userId: string, letterId: string) {
    // Verify ownership before updating
    const letter = await this.prisma.capsuleLetter.findFirst({
      where: { id: letterId, userId },
    });
    if (!letter) return null;

    return this.prisma.capsuleLetter.update({
      where: { id: letterId },
      data:  { readAt: new Date() },
    });
  }

  /**
   * Save the two Day-1 sealed answers from onboarding.
   * Idempotent — silently returns existing record if already saved.
   */
  async saveSealedAnswers(
    userId:     string,
    whoAreYou:  string,
    whoWillYou: string,
  ) {
    const existing = await this.prisma.timeCapsuleAnswers.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.timeCapsuleAnswers.create({
      data: { userId, whoAreYou, whoWillYou },
    });
  }
}

// ─── Gemini prompt builder ────────────────────────────────────────────────────
//
// PSYCHOLOGICAL AUDIT — prompt enforces all rules:
// ✓ No prescriptive language     ✓ No deficit framing
// ✓ No comparison to others      ✓ Observational warm second person
// ✓ Under 250 words              ✓ Plain prose, no markdown

function buildPrompt(ctx: {
  type:        string;
  userName:    string;
  answers:     { whoAreYou: string; whoWillYou: string } | null;
  hours:       { productive: number; leisure: number; restoration: number; neutral: number };
  totalLogged: number;
  totalDays:   number;
  mood:        Awaited<ReturnType<MoodNarrativeService['build']>>;
  signupDate:  Date;
}): string {
  const { type, userName, answers, hours, totalLogged, totalDays, mood, signupDate } = ctx;

  const dateLabel = signupDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const dominant = Object.entries(hours).sort(([, a], [, b]) => b - a)[0][0];

  return `You are writing a personal time capsule letter on behalf of LifeChrono — a self-awareness companion.

This is a ${type.replace('_', '-')} letter. It arrives ${totalDays} days after the person opened the app for the first time.

STRUCTURE — write exactly four parts, in this order:

PART 1: Quote their Day-1 answer back exactly.
Open with: "${userName},"
Then: "On ${dateLabel}, you wrote this:"
Then quote their answer on its own line in quotation marks.

PART 2: Quote their second Day-1 answer.
"You also wrote:"
Then their answer on its own line in quotation marks.

PART 3: What the river showed — 3 to 4 warm observational sentences.
Reference specific hours. Weave in the mood arc naturally and quietly.
Never evaluate. Never advise. Describe what you saw, as a witness would.

PART 4: One closing question.
Write: "One question for the months ahead:"
Then the question on its own line. Make it genuine — something the data suggests might matter to this person specifically.

Sign off: "— Your River"

STRICT RULES — violating any of these means the output is wrong:
- Never use: should, must, need to, try, improve, better, worse, behind, failed, not enough, only logged
- Never compare to others or to averages
- Warm second person throughout
- Plain prose — no headers, no bullet points, no markdown, no asterisks
- Maximum 250 words

DATA:
Name: ${userName}
Day-1 answer 1 — who they were: "${answers?.whoAreYou ?? '[not recorded]'}"
Day-1 answer 2 — who they hoped to become: "${answers?.whoWillYou ?? '[not recorded]'}"
Total logged hours: ${totalLogged.toFixed(0)}h over ${totalDays} days
Dominant category: ${dominant}
Breakdown: Productive ${hours.productive.toFixed(1)}h · Rest ${hours.restoration.toFixed(1)}h · Leisure ${hours.leisure.toFixed(1)}h · Neutral ${hours.neutral.toFixed(1)}h

MOOD ARC (weave this in naturally — do not list it):
${mood.narrative}
Trajectory: ${mood.trajectory}
Days with weather logged: ${mood.totalDaysLogged} of ${totalDays}

Write the letter now. Plain prose only.`;
}