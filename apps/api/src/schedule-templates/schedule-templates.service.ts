// FILE: apps/api/src/schedule-templates/schedule-templates.service.ts

import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Category, GhostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, ConfirmGhostDto } from './dto/schedule-template.dto';

// ── Constants ────────────────────────────────────────────────────────────────
const GHOST_CATCHUP_DAYS = 1;    // Day 0 = today, Day 1 = yesterday (still catchup)
const MIN_TEMPLATE_MINUTES = 180;  // templates smaller than this don't trigger prompt
const COVERAGE_THRESHOLD = 0.50; // below 50% coverage → prompt eligible

// ── Confidence thresholds ────────────────────────────────────────────────────
function calcConfidence(editCount: number): number {
  if (editCount === 0) return 1.00;
  if (editCount === 1) return 0.85;
  if (editCount === 2) return 0.70;
  return 0.50;
}

// ── Interval union helper ─────────────────────────────────────────────────────
// Takes [{start, end}] in minutes-since-midnight, returns total covered minutes
// (deduplicates overlapping intervals so we don't double-count)
function unionMinutes(intervals: { start: number; end: number }[]): number {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start <= curEnd) {
      curEnd = Math.max(curEnd, sorted[i].end);
    } else {
      total += curEnd - curStart;
      curStart = sorted[i].start;
      curEnd = sorted[i].end;
    }
  }
  total += curEnd - curStart;
  return total;
}

@Injectable()
export class ScheduleTemplatesService {
  constructor(private prisma: PrismaService) { }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(userId: string) {
    return this.prisma.scheduleTemplate.findMany({
      where: { userId },
      include: { blocks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateTemplateDto) {
    const { blocks, ...rest } = dto;
    return this.prisma.scheduleTemplate.create({
      data: {
        ...rest,
        userId,
        blocks: { create: blocks.map((b, i) => ({ ...b, order: b.order ?? i })) },
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.assertOwner(userId, id);
    const { blocks, ...rest } = dto;
    return this.prisma.$transaction(async tx => {
      if (blocks) {
        const existing = await tx.templateBlock.findMany({ where: { templateId: id } });
        await tx.templateBlock.deleteMany({ where: { templateId: id } });
        await tx.templateBlock.createMany({
          data: blocks.map((b, i) => {
            const match = existing.find(
              e => e.title === b.title && e.startHour === b.startHour && e.startMinute === b.startMinute
            );
            return {
              ...b,
              templateId: id,
              order: b.order ?? i,
              editCounts: match?.editCounts ?? {},
              adjustedTimes: match?.adjustedTimes ?? {},
            };
          }),
        });
      }
      return tx.scheduleTemplate.update({
        where: { id },
        data: rest,
        include: { blocks: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    const template = await this.prisma.scheduleTemplate.findUnique({
      where: { id }, include: { blocks: true },
    });
    if (template) {
      const blockIds = template.blocks.map(b => b.id);
      await this.prisma.ghostEntry.deleteMany({
        where: { templateBlockId: { in: blockIds } },
      });
    }
    await this.prisma.scheduleTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ── Ghost generation ──────────────────────────────────────────────────────
  // GET /schedule-templates/ghosts?date=YYYY-MM-DD
  //
  // Day 0 (today):     full ghost display, normal confidence
  // Day 1 (yesterday): catch-up mode — ghosts still confirmable, slightly faded
  // Day 2+:            expire any remaining PENDING ghosts, return []
  // Future dates:      return []
  //
  // EXPIRED ≠ DISMISSED:
  //   DISMISSED = user explicitly said "not today" (intentional signal)
  //   EXPIRED   = system cleanup, day passed without action (no intent signal)

  async getOrCreateGhosts(userId: string, dateString: string) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const daysDiff = Math.round(
      (todayUTC.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Future dates — never generate ghosts
    if (daysDiff < 0) return [];

    // Day 2+ — expire any PENDING ghosts for this date and return []
    // Cast needed until `npx prisma generate` adds EXPIRED to the generated enum
    if (daysDiff > GHOST_CATCHUP_DAYS) {
      await this.prisma.ghostEntry.updateMany({
        where: { userId, date, status: GhostStatus.PENDING },
        data: { status: 'EXPIRED' as any },
      });
      return [];
    }

    // Day 0 or Day 1 — generate ghosts if not already done
    const dayOfWeek = date.getUTCDay();

    const existing = await this.prisma.ghostEntry.findMany({
      where: { userId, date, status: GhostStatus.PENDING },
      orderBy: { startTime: 'asc' },
    });
    if (existing.length) return existing.map(g => ({ ...g, catchup: daysDiff === 1 }));

    // Find templates active on this day of week
    const templates = await this.prisma.scheduleTemplate.findMany({
      where: { userId, isActive: true, daysOfWeek: { has: dayOfWeek } },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });
    if (!templates.length) return [];

    // Find real entries already logged — skip overlapping blocks
    const realEntries = await this.prisma.timeEntry.findMany({
      where: { userId, date },
    });

    const ghosts = templates.flatMap(tmpl =>
      tmpl.blocks.map(block => {
        const dow = String(dayOfWeek);
        const adjusted = (block.adjustedTimes as any)[dow];
        const sh = adjusted?.startHour ?? block.startHour;
        const sm = adjusted?.startMinute ?? block.startMinute;
        const eh = adjusted?.endHour ?? block.endHour;
        const em = adjusted?.endMinute ?? block.endMinute;

        const editCount = (block.editCounts as any)[dow] ?? 0;
        const confidence = calcConfidence(editCount);

        const startTime = new Date(date); startTime.setUTCHours(sh, sm, 0, 0);
        const endTime = new Date(date); endTime.setUTCHours(eh, em, 0, 0);

        return {
          userId, date, templateBlockId: block.id, title: block.title,
          category: block.category, startTime, endTime, confidence
        };
      })
    );

    const nonOverlapping = ghosts.filter(g =>
      !realEntries.some(e =>
        new Date(e.startTime) < g.endTime && new Date(e.endTime) > g.startTime
      )
    );
    if (!nonOverlapping.length) return [];

    await this.prisma.ghostEntry.createMany({ data: nonOverlapping, skipDuplicates: true });

    const created = await this.prisma.ghostEntry.findMany({
      where: { userId, date, status: GhostStatus.PENDING },
      orderBy: { startTime: 'asc' },
    });

    // Attach catchup flag — tells frontend to render slightly faded
    return created.map(g => ({ ...g, catchup: daysDiff === 1 }));
  }

  // ── Confirm ghost → real TimeEntry ────────────────────────────────────────
  async confirmGhost(userId: string, ghostId: string, dto: ConfirmGhostDto = {}) {
    const ghost = await this.prisma.ghostEntry.findUnique({ where: { id: ghostId } });
    if (!ghost) throw new NotFoundException('Ghost not found');
    if (ghost.userId !== userId) throw new ForbiddenException();
    if (ghost.status === GhostStatus.CONFIRMED || ghost.status === GhostStatus.EDITED) {
      return { message: 'Already confirmed' };
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : ghost.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : ghost.endTime;
    const timeChanged = !!(dto.startTime || dto.endTime);
    const wasEdited = !!(dto.title || dto.category || timeChanged);

    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        date: ghost.date,
        title: dto.title ?? ghost.title,
        category: (dto.category ?? ghost.category) as Category,
        startTime,
        endTime,
        durationMinutes: Math.max(
          1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)
        ),
      },
    });

    await this.prisma.ghostEntry.update({
      where: { id: ghostId },
      data: {
        status: wasEdited ? GhostStatus.EDITED : GhostStatus.CONFIRMED,
        confirmedEntryId: entry.id
      },
    });

    if (timeChanged) {
      await this.recordTimeAdjustment(ghost.templateBlockId, ghost.date, startTime, endTime);
    }

    return entry;
  }

  // ── Dismiss ghost (user intent) ───────────────────────────────────────────
  async dismissGhost(userId: string, ghostId: string) {
    const ghost = await this.prisma.ghostEntry.findUnique({ where: { id: ghostId } });
    if (!ghost || ghost.userId !== userId) throw new ForbiddenException();
    return this.prisma.ghostEntry.update({
      where: { id: ghostId },
      data: { status: GhostStatus.DISMISSED },   // intentional user signal
    });
  }

  // ── Catchup prompt ────────────────────────────────────────────────────────
  // GET /routine/catchup?date=YYYY-MM-DD
  //
  // Returns whether the "fill yesterday" banner should show.
  // Strict eligibility criteria (all must pass):
  //   1. Date is within catchup window (yesterday only)
  //   2. User has not already dismissed the banner for this date
  //   3. Active templates for that day total ≥ MIN_TEMPLATE_MINUTES
  //   4. User had SOME activity (confirmed/edited ghosts OR manual entries > 0)
  //   5. Coverage (union of confirmed ghosts + manual entries) < COVERAGE_THRESHOLD
  //
  // Coverage uses interval union — no double-counting if entries overlap template

  async getCatchupPrompt(userId: string, dateString: string) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const daysDiff = Math.round(
      (todayUTC.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only evaluate for yesterday
    if (daysDiff !== 1) {
      return { shouldShow: false, reason: 'TOO_OLD' };
    }

    // Check persistent dismissal for this date
    // Cast needed until `npx prisma generate` adds catchupDismissal to PrismaClient
    const dismissed = await (this.prisma as any).catchupDismissal.findUnique({
      where: { userId_forDate: { userId, forDate: date } },
    });
    if (dismissed) {
      return { shouldShow: false, reason: 'DISMISSED_BY_USER' };
    }

    const dayOfWeek = date.getUTCDay();

    // Get active templates for this day
    const templates = await this.prisma.scheduleTemplate.findMany({
      where: { userId, isActive: true, daysOfWeek: { has: dayOfWeek } },
      include: { blocks: true },
    });
    if (!templates.length) {
      return { shouldShow: false, reason: 'NO_TEMPLATE' };
    }

    // Calculate total template block minutes for this day
    const templateIntervals = templates.flatMap(t =>
      t.blocks.map(b => {
        const dow = String(dayOfWeek);
        const adj = (b.adjustedTimes as any)[dow];
        const sh = adj?.startHour ?? b.startHour;
        const sm = adj?.startMinute ?? b.startMinute;
        const eh = adj?.endHour ?? b.endHour;
        const em = adj?.endMinute ?? b.endMinute;
        return { start: sh * 60 + sm, end: eh * 60 + em };
      })
    );

    const expectedMinutes = unionMinutes(templateIntervals);

    // Guard: template too small to be meaningful
    if (expectedMinutes < MIN_TEMPLATE_MINUTES) {
      return {
        shouldShow: false, reason: 'TEMPLATE_TOO_SMALL',
        expectedMinutes, threshold: MIN_TEMPLATE_MINUTES
      };
    }

    // Get all confirmed/edited ghosts for this date
    const confirmedGhosts = await this.prisma.ghostEntry.findMany({
      where: { userId, date, status: { in: [GhostStatus.CONFIRMED, GhostStatus.EDITED] } },
    });

    // Get all manual time entries for this date
    const manualEntries = await this.prisma.timeEntry.findMany({
      where: { userId, date },
    });

    // Guard: user had NO activity at all → unusual day, don't prompt
    const hasActivity = confirmedGhosts.length > 0 || manualEntries.length > 0;
    if (!hasActivity) {
      return {
        shouldShow: false, reason: 'NO_ACTIVITY',
        expectedMinutes
      };
    }

    // Calculate coverage using interval union (avoids double-counting)
    const coveredIntervals: { start: number; end: number }[] = [
      // From confirmed ghosts
      ...confirmedGhosts.map(g => ({
        start: g.startTime.getUTCHours() * 60 + g.startTime.getUTCMinutes(),
        end: g.endTime.getUTCHours() * 60 + g.endTime.getUTCMinutes(),
      })),
      // From manual entries (non-ghost real entries)
      ...manualEntries.map(e => ({
        start: new Date(e.startTime).getUTCHours() * 60 + new Date(e.startTime).getUTCMinutes(),
        end: new Date(e.endTime).getUTCHours() * 60 + new Date(e.endTime).getUTCMinutes(),
      })),
    ];

    const coveredMinutes = unionMinutes(coveredIntervals);
    const coveragePct = coveredMinutes / expectedMinutes;

    if (coveragePct >= COVERAGE_THRESHOLD) {
      return {
        shouldShow: false, reason: 'ENOUGH_COVERAGE',
        coveredMinutes, expectedMinutes,
        coveragePct: Math.round(coveragePct * 100)
      };
    }

    // All checks passed → show the prompt
    return {
      shouldShow: true,
      reason: 'SPARSE_COVERAGE',
      coveredMinutes,
      expectedMinutes,
      coveragePct: Math.round(coveragePct * 100),
    };
  }

  // ── Dismiss catchup banner (persistent) ──────────────────────────────────
  // POST /routine/catchup/dismiss  body: { forDate: 'YYYY-MM-DD' }
  // Creates a CatchupDismissal row so the banner never reappears for that date

  async dismissCatchupBanner(userId: string, forDateString: string) {
    const forDate = new Date(forDateString + 'T00:00:00.000Z');
    await (this.prisma as any).catchupDismissal.upsert({
      where: { userId_forDate: { userId, forDate } },
      create: { userId, forDate },
      update: { dismissedAt: new Date() },
    });
    return { success: true };
  }

  // ── Exception memory ──────────────────────────────────────────────────────
  private async recordTimeAdjustment(
    blockId: string, date: Date, newStart: Date, newEnd: Date,
  ) {
    const block = await this.prisma.templateBlock.findUnique({ where: { id: blockId } });
    if (!block) return;

    const dow = String(date.getUTCDay());
    const editCounts = { ...(block.editCounts as any) };
    const adjustedTimes = { ...(block.adjustedTimes as any) };

    editCounts[dow] = (editCounts[dow] ?? 0) + 1;

    if (editCounts[dow] >= 2) {
      adjustedTimes[dow] = {
        startHour: newStart.getUTCHours(),
        startMinute: newStart.getUTCMinutes(),
        endHour: newEnd.getUTCHours(),
        endMinute: newEnd.getUTCMinutes(),
      };
    }

    await this.prisma.templateBlock.update({
      where: { id: blockId },
      data: { editCounts, adjustedTimes },
    });
  }

  // ── Adaptation suggestions ────────────────────────────────────────────────
  async getAdaptationSuggestions(userId: string) {
    const templates = await this.prisma.scheduleTemplate.findMany({
      where: { userId },
      include: { blocks: true },
    });

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const suggestions: any[] = [];

    for (const tmpl of templates) {
      for (const block of tmpl.blocks) {
        const counts = block.editCounts as any;
        const adjusted = block.adjustedTimes as any;

        for (const [dow, times] of Object.entries(adjusted)) {
          const count = counts[dow] ?? 0;
          if (count < 3) continue;

          const t = times as any;
          const pad = (n: number) => String(n).padStart(2, '0');
          const currentStart = `${pad(block.startHour)}:${pad(block.startMinute)}`;
          const currentEnd = `${pad(block.endHour)}:${pad(block.endMinute)}`;
          const suggestedStart = `${pad(t.startHour)}:${pad(t.startMinute)}`;
          const suggestedEnd = `${pad(t.endHour)}:${pad(t.endMinute)}`;

          if (currentStart === suggestedStart && currentEnd === suggestedEnd) continue;

          suggestions.push({
            blockId: block.id,
            templateId: tmpl.id,
            templateName: tmpl.name,
            blockTitle: block.title,
            dayOfWeek: Number(dow),
            dayName: DAYS[Number(dow)],
            currentStart, currentEnd,
            suggestedStart, suggestedEnd,
            editCount: count,
            message: `It looks like your ${block.title} on ${DAYS[Number(dow)]} usually starts at ${suggestedStart} now.`,
          });
        }
      }
    }

    return suggestions;
  }

  // ── Apply / dismiss adaptation suggestion ─────────────────────────────────
  async applyAdaptation(userId: string, blockId: string, dayOfWeek: number) {
    const block = await this.prisma.templateBlock.findUnique({
      where: { id: blockId }, include: { template: true },
    });
    if (!block || block.template.userId !== userId) throw new ForbiddenException();

    const adjusted = (block.adjustedTimes as any)[String(dayOfWeek)];
    if (!adjusted) throw new NotFoundException('No adjustment data for this day');

    await this.prisma.templateBlock.update({
      where: { id: blockId },
      data: {
        startHour: adjusted.startHour,
        startMinute: adjusted.startMinute,
        endHour: adjusted.endHour,
        endMinute: adjusted.endMinute,
        editCounts: { ...(block.editCounts as any), [String(dayOfWeek)]: 0 },
        adjustedTimes: { ...(block.adjustedTimes as any), [String(dayOfWeek)]: undefined },
      },
    });

    return { success: true };
  }

  async dismissAdaptation(userId: string, blockId: string, dayOfWeek: number) {
    const block = await this.prisma.templateBlock.findUnique({
      where: { id: blockId }, include: { template: true },
    });
    if (!block || block.template.userId !== userId) throw new ForbiddenException();

    const editCounts = { ...(block.editCounts as any) };
    editCounts[String(dayOfWeek)] = 0;

    await this.prisma.templateBlock.update({
      where: { id: blockId },
      data: { editCounts },
    });

    return { success: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private async assertOwner(userId: string, id: string) {
    const t = await this.prisma.scheduleTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template not found');
    if (t.userId !== userId) throw new ForbiddenException();
  }
}