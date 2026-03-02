import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Public shape returned to CapsuleLetterService ─────────────────────────────
export interface MoodNarrative {
  totalDaysLogged: number;
  totalDays:       number;
  coveragePct:     number;

  distribution: {
    score1: number;
    score2: number;
    score3: number;
    score4: number;
    score5: number;
  };

  monthlyAverages: {
    month1: number | null;
    month2: number | null;
    month3: number | null;
  };

  // Shape of the arc across the window
  trajectory: 'climbing' | 'declining' | 'steady' | 'dip_and_return' | 'sparse';

  longestLowStreak:  { days: number; startDate: string } | null;
  longestHighStreak: { days: number; startDate: string } | null;

  lowestDay:  { date: string; score: number; note: string | null } | null;
  highestDay: { date: string; score: number; note: string | null } | null;

  // Longest note the user wrote — their own words, quoted in the letter
  mostMeaningfulNote: { date: string; note: string } | null;

  // Ready-to-use paragraph sent directly to Gemini
  narrative: string;
}

// ── Internal working type ─────────────────────────────────────────────────────
interface DayAvg {
  date: string;
  avg:  number;
  note: string | null;
}

@Injectable()
export class MoodNarrativeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a complete mood narrative for a user across a date window.
   * from / to are inclusive. For a 3-month letter: signupDate → day 91.
   */
  async build(userId: string, from: Date, to: Date): Promise<MoodNarrative> {
    const logs = await this.prisma.moodLog.findMany({
      where:   { userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

    // ── Group raw logs by calendar date ──────────────────────────────────
    const byDate = new Map<string, { scores: number[]; notes: string[] }>();
    for (const log of logs) {
      const key = log.date.toISOString().split('T')[0];
      if (!byDate.has(key)) byDate.set(key, { scores: [], notes: [] });
      byDate.get(key)!.scores.push(log.score);
      if (log.note) byDate.get(key)!.notes.push(log.note);
    }

    // ── Build sorted daily averages ───────────────────────────────────────
    const dailyAvgs: DayAvg[] = [];
    for (const [date, { scores, notes }] of byDate.entries()) {
      const avg  = scores.reduce((a, b) => a + b, 0) / scores.length;
      // Prefer the last note of the day (most reflective)
      const note = notes.length > 0 ? notes[notes.length - 1] : null;
      dailyAvgs.push({ date, avg: Math.round(avg * 10) / 10, note });
    }
    dailyAvgs.sort((a, b) => a.date.localeCompare(b.date));

    const totalDaysLogged = dailyAvgs.length;

    // ── Score distribution ────────────────────────────────────────────────
    const distribution = { score1: 0, score2: 0, score3: 0, score4: 0, score5: 0 };
    for (const { avg } of dailyAvgs) {
      const bucket = Math.min(5, Math.max(1, Math.round(avg)));
      (distribution as any)[`score${bucket}`]++;
    }

    // ── Monthly averages ─────────────────────────────────────────────────
    const monthlyAverages = this.computeMonthlyAverages(dailyAvgs, from);

    // ── Trajectory ───────────────────────────────────────────────────────
    const trajectory = this.detectTrajectory(monthlyAverages, totalDaysLogged, totalDays);

    // ── Streaks ───────────────────────────────────────────────────────────
    const longestLowStreak  = this.longestStreak(dailyAvgs, d => d.avg <= 2);
    const longestHighStreak = this.longestStreak(dailyAvgs, d => d.avg >= 4);

    // ── Notable days ─────────────────────────────────────────────────────
    const sorted   = [...dailyAvgs].sort((a, b) => a.avg - b.avg);
    const lowestDay  = sorted.length ? { date: sorted[0].date,  score: sorted[0].avg,  note: sorted[0].note  } : null;
    const highestDay = sorted.length ? { date: sorted.at(-1)!.date, score: sorted.at(-1)!.avg, note: sorted.at(-1)!.note } : null;

    // ── Most meaningful note ──────────────────────────────────────────────
    const withNotes = dailyAvgs.filter(d => d.note && d.note.trim().length > 0);
    const mostMeaningfulNote = withNotes.length
      ? withNotes.sort((a, b) => b.note!.length - a.note!.length)[0]
      : null;

    // ── Build human-readable paragraph ───────────────────────────────────
    // Narrow mostMeaningfulNote.note from string|null to string here —
    // safe because withNotes already filtered to entries where note exists.
    const mostMeaningfulNoteNarrowed = mostMeaningfulNote
      ? { date: mostMeaningfulNote.date, note: mostMeaningfulNote.note! }
      : null;

    const narrative = this.buildNarrative({
      totalDaysLogged, totalDays,
      monthlyAverages, trajectory,
      longestLowStreak, longestHighStreak,
      lowestDay, highestDay,
      mostMeaningfulNote: mostMeaningfulNoteNarrowed,
    });

    return {
      totalDaysLogged, totalDays,
      coveragePct: Math.round((totalDaysLogged / totalDays) * 100),
      distribution,
      monthlyAverages,
      trajectory,
      longestLowStreak,
      longestHighStreak,
      lowestDay,
      highestDay,
      mostMeaningfulNote: mostMeaningfulNote
        ? { date: mostMeaningfulNote.date, note: mostMeaningfulNote.note! }
        : null,
      narrative,
    };
  }

  // ── Private: monthly averages ────────────────────────────────────────────

  private computeMonthlyAverages(
    days: DayAvg[],
    from: Date,
  ): MoodNarrative['monthlyAverages'] {
    // Split window into 3 roughly equal blocks of ~30 days
    const m1End = new Date(from); m1End.setDate(m1End.getDate() + 30);
    const m2End = new Date(from); m2End.setDate(m2End.getDate() + 61);
    const m3End = new Date(from); m3End.setDate(m3End.getDate() + 92);

    const fromStr = from.toISOString().split('T')[0];
    const m1Str   = m1End.toISOString().split('T')[0];
    const m2Str   = m2End.toISOString().split('T')[0];
    const m3Str   = m3End.toISOString().split('T')[0];

    const avg = (bucket: DayAvg[]) =>
      bucket.length
        ? Math.round((bucket.reduce((s, d) => s + d.avg, 0) / bucket.length) * 10) / 10
        : null;

    return {
      month1: avg(days.filter(d => d.date >= fromStr && d.date < m1Str)),
      month2: avg(days.filter(d => d.date >= m1Str  && d.date < m2Str)),
      month3: avg(days.filter(d => d.date >= m2Str  && d.date < m3Str)),
    };
  }

  // ── Private: trajectory detection ───────────────────────────────────────

  private detectTrajectory(
    avgs:   MoodNarrative['monthlyAverages'],
    logged: number,
    total:  number,
  ): MoodNarrative['trajectory'] {
    if (logged / total < 0.2) return 'sparse';

    const { month1, month2, month3 } = avgs;
    if (month1 === null || month3 === null) return 'sparse';

    const delta = month3 - month1;

    // Dip and return: month2 meaningfully lower than both ends
    if (
      month2 !== null &&
      month2 < month1 - 0.35 &&
      month3 >= month1 - 0.25
    ) return 'dip_and_return';

    if (delta >  0.35) return 'climbing';
    if (delta < -0.35) return 'declining';
    return 'steady';
  }

  // ── Private: streak finder ───────────────────────────────────────────────

  private longestStreak(
    days: DayAvg[],
    condition: (d: DayAvg) => boolean,
  ): MoodNarrative['longestLowStreak'] {
    let best:    { days: number; startDate: string } | null = null;
    let current: { days: number; startDate: string } | null = null;
    let prevDate: Date | null = null;

    for (const day of days) {
      const d = new Date(day.date);
      const isConsecutive =
        prevDate !== null &&
        Math.round((d.getTime() - prevDate.getTime()) / 86_400_000) === 1;

      if (condition(day)) {
        current = isConsecutive && current
          ? { days: current.days + 1, startDate: current.startDate }
          : { days: 1, startDate: day.date };
        if (!best || current.days > best.days) best = { ...current };
      } else {
        current = null;
      }
      prevDate = d;
    }

    // Only surface streaks of 2+ days — single days aren't meaningful
    return best && best.days >= 2 ? best : null;
  }

  // ── Private: narrative paragraph builder ────────────────────────────────
  //
  // This paragraph is passed verbatim to Gemini as the MOOD ARC section.
  // Rules: observational only, warm, no evaluation, no prescriptions.

  private buildNarrative(data: {
    totalDaysLogged:    number;
    totalDays:          number;
    monthlyAverages:    MoodNarrative['monthlyAverages'];
    trajectory:         MoodNarrative['trajectory'];
    longestLowStreak:   MoodNarrative['longestLowStreak'];
    longestHighStreak:  MoodNarrative['longestHighStreak'];
    lowestDay:          MoodNarrative['lowestDay'];
    highestDay:         MoodNarrative['highestDay'];
    mostMeaningfulNote: { date: string; note: string } | null;
  }): string {
    const {
      totalDaysLogged, totalDays, monthlyAverages, trajectory,
      longestLowStreak, longestHighStreak, lowestDay, highestDay,
      mostMeaningfulNote,
    } = data;

    const pct = Math.round((totalDaysLogged / totalDays) * 100);
    const parts: string[] = [];

    // ── Coverage ──
    if (pct < 20) {
      parts.push(
        `Weather was recorded on ${totalDaysLogged} of ${totalDays} days — ` +
        `most of this period's sky remains uncharted.`,
      );
    } else {
      parts.push(
        `Weather was recorded on ${totalDaysLogged} of ${totalDays} days (${pct}% of the window).`,
      );
    }

    // ── Monthly shape ──
    const { month1, month2, month3 } = monthlyAverages;
    if (month1 !== null && month2 !== null && month3 !== null) {
      parts.push(
        `The first month averaged ${month1}/5, the second ${month2}/5, the third ${month3}/5.`,
      );
    } else if (month1 !== null && month3 !== null) {
      parts.push(
        `The first month averaged ${month1}/5 and the third ${month3}/5.`,
      );
    }

    // ── Trajectory ──
    const trajectoryLines: Record<MoodNarrative['trajectory'], string> = {
      climbing:       'The weather lifted as the months passed.',
      declining:      'The weather grew heavier across the three months.',
      steady:         'The weather held a consistent quality throughout.',
      dip_and_return: 'The middle period was heavier; the weather recovered toward the end.',
      sparse:         'With limited weather data, the full arc remains partly in the mist.',
    };
    parts.push(trajectoryLines[trajectory]);

    // ── Low streak ──
    if (longestLowStreak) {
      const month = new Date(longestLowStreak.startDate)
        .toLocaleDateString('en-US', { month: 'long' });
      parts.push(
        `The longest overcast stretch ran ${longestLowStreak.days} consecutive days, beginning in ${month}.`,
      );
    }

    // ── High streak ──
    if (longestHighStreak) {
      const month = new Date(longestHighStreak.startDate)
        .toLocaleDateString('en-US', { month: 'long' });
      parts.push(
        `The longest clear stretch ran ${longestHighStreak.days} days in a row, beginning in ${month}.`,
      );
    }

    // ── Notable day notes — user's own words quoted back ──
    if (lowestDay?.note) {
      const label = new Date(lowestDay.date)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      parts.push(`On ${label} — the heaviest day — you wrote: "${lowestDay.note}"`);
    }

    if (
      highestDay?.note &&
      highestDay.date !== lowestDay?.date
    ) {
      const label = new Date(highestDay.date)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      parts.push(`On ${label} — the clearest day — you wrote: "${highestDay.note}"`);
    }

    // ── Most meaningful note (if different from notable days) ──
    if (
      mostMeaningfulNote &&
      mostMeaningfulNote.date !== lowestDay?.date &&
      mostMeaningfulNote.date !== highestDay?.date
    ) {
      const label = new Date(mostMeaningfulNote.date)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      parts.push(`On ${label} you wrote: "${mostMeaningfulNote.note}"`);
    }

    return parts.join(' ');
  }
}