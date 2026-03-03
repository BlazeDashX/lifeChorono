import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Category, GhostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, ConfirmGhostDto } from './dto/schedule-template.dto';

// ── Confidence thresholds ────────────────────────────────────────────────────
// editCount on this weekday → confidence score
// 0 edits  = 1.00  (solid ghost   — this is your routine)
// 1 edit   = 0.85  (medium ghost  — usually happens, slight variation)
// 2 edits  = 0.70  (light ghost   — often varies)
// 3+ edits = 0.50  (faint ghost   — uncertain, just a nudge)
function calcConfidence(editCount: number): number {
  if (editCount === 0) return 1.00;
  if (editCount === 1) return 0.85;
  if (editCount === 2) return 0.70;
  return 0.50;
}

@Injectable()
export class ScheduleTemplatesService {
  constructor(private prisma: PrismaService) { }

  // ── CRUD ─────────────────────────────────────────────────────────────────

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
        blocks: {
          create: blocks.map((b, i) => ({ ...b, order: b.order ?? i })),
        },
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.assertOwner(userId, id);
    const { blocks, ...rest } = dto;

    return this.prisma.$transaction(async tx => {
      if (blocks) {
        // Replace all blocks atomically — preserves editCounts/adjustedTimes
        // for existing blocks by matching on title+startHour+startMinute
        const existing = await tx.templateBlock.findMany({ where: { templateId: id } });

        await tx.templateBlock.deleteMany({ where: { templateId: id } });

        await tx.templateBlock.createMany({
          data: blocks.map((b, i) => {
            // Try to preserve exception memory for blocks with the same signature
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
    // GhostEntries cascade via templateBlockId FK isn't set — clean up manually
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

  // ── Ghost generation ─────────────────────────────────────────────────────
  // GET /schedule-templates/ghosts?date=YYYY-MM-DD
  // Returns existing PENDING ghosts, or generates them fresh for the day.
  // Already-confirmed or dismissed ghosts are excluded from the return.

  async getOrCreateGhosts(userId: string, dateString: string) {
    const date = new Date(dateString + 'T00:00:00.000Z');
    const dayOfWeek = date.getUTCDay();

    // Return existing pending ghosts if already generated
    const existing = await this.prisma.ghostEntry.findMany({
      where: { userId, date, status: 'PENDING' },
      orderBy: { startTime: 'asc' },
    });
    if (existing.length) return existing;

    // Find templates active on this day of week
    const templates = await this.prisma.scheduleTemplate.findMany({
      where: { userId, isActive: true, daysOfWeek: { has: dayOfWeek } },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });
    if (!templates.length) return [];

    // Find real entries already logged for this date (avoid overlapping ghosts)
    const realEntries = await this.prisma.timeEntry.findMany({
      where: { userId, date },
    });

    // Build ghost candidates from template blocks
    const ghosts = templates.flatMap(tmpl =>
      tmpl.blocks.map(block => {
        const dow = String(dayOfWeek);

        // Use adjusted times if exception memory has locked them in
        const adjusted = (block.adjustedTimes as any)[dow];
        const sh = adjusted?.startHour ?? block.startHour;
        const sm = adjusted?.startMinute ?? block.startMinute;
        const eh = adjusted?.endHour ?? block.endHour;
        const em = adjusted?.endMinute ?? block.endMinute;

        const editCount = (block.editCounts as any)[dow] ?? 0;
        const confidence = calcConfidence(editCount);

        const startTime = new Date(date);
        startTime.setUTCHours(sh, sm, 0, 0);
        const endTime = new Date(date);
        endTime.setUTCHours(eh, em, 0, 0);

        return {
          userId,
          date,
          templateBlockId: block.id,
          title: block.title,
          category: block.category,
          startTime,
          endTime,
          confidence,
        };
      })
    );

    // Filter out any ghost that overlaps an already-logged real entry
    const nonOverlapping = ghosts.filter(g =>
      !realEntries.some(e =>
        new Date(e.startTime) < g.endTime && new Date(e.endTime) > g.startTime
      )
    );

    if (!nonOverlapping.length) return [];

    await this.prisma.ghostEntry.createMany({
      data: nonOverlapping,
      skipDuplicates: true,
    });

    return this.prisma.ghostEntry.findMany({
      where: { userId, date, status: 'PENDING' },
      orderBy: { startTime: 'asc' },
    });
  }

  // ── Confirm ghost → real TimeEntry ───────────────────────────────────────
  async confirmGhost(userId: string, ghostId: string, dto: ConfirmGhostDto = {}) {
    const ghost = await this.prisma.ghostEntry.findUnique({ where: { id: ghostId } });
    if (!ghost) throw new NotFoundException('Ghost not found');
    if (ghost.userId !== userId) throw new ForbiddenException();
    if (ghost.status === 'CONFIRMED' || ghost.status === 'EDITED') {
      return { message: 'Already confirmed' };
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : ghost.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : ghost.endTime;
    const timeChanged = dto.startTime || dto.endTime;
    const wasEdited = !!(dto.title || dto.category || timeChanged);

    // Create the real entry
    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        date: ghost.date,
        title: dto.title ?? ghost.title,
        category: (dto.category ?? ghost.category) as Category,
        startTime,
        endTime,
        durationMinutes: Math.max(
          1,
          Math.round((endTime.getTime() - startTime.getTime()) / 60000)
        ),
      },
    });

    // Mark ghost as confirmed/edited
    await this.prisma.ghostEntry.update({
      where: { id: ghostId },
      data: {
        status: wasEdited ? 'EDITED' : 'CONFIRMED',
        confirmedEntryId: entry.id,
      },
    });

    // Record exception memory if time was changed
    if (timeChanged) {
      await this.recordTimeAdjustment(
        ghost.templateBlockId,
        ghost.date,
        startTime,
        endTime
      );
    }

    return entry;
  }

  // ── Dismiss ghost ─────────────────────────────────────────────────────────
  async dismissGhost(userId: string, ghostId: string) {
    const ghost = await this.prisma.ghostEntry.findUnique({ where: { id: ghostId } });
    if (!ghost || ghost.userId !== userId) throw new ForbiddenException();
    return this.prisma.ghostEntry.update({
      where: { id: ghostId },
      data: { status: 'DISMISSED' },
    });
  }

  // ── Exception memory ──────────────────────────────────────────────────────
  // Tracks time adjustments per weekday on each template block.
  // After 2+ adjustments on the same weekday, locks in adjusted time
  // so future ghosts auto-use the corrected time.
  private async recordTimeAdjustment(
    blockId: string,
    date: Date,
    newStart: Date,
    newEnd: Date,
  ) {
    const block = await this.prisma.templateBlock.findUnique({ where: { id: blockId } });
    if (!block) return;

    const dow = String(date.getUTCDay());
    const editCounts = { ...(block.editCounts as any) };
    const adjustedTimes = { ...(block.adjustedTimes as any) };

    editCounts[dow] = (editCounts[dow] ?? 0) + 1;

    // After 2 edits on the same weekday — lock the adjusted time
    // so future ghosts pre-populate with the corrected time
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
  // Returns blocks where the user has adjusted times 3+ times on the same
  // weekday — the system suggests updating the template to match reality.
  // Framed as: "It looks like your [title] on [day] usually starts at [time] now."
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
          if (count < 3) continue;  // Only surface after 3+ edits

          const t = times as any;
          const pad = (n: number) => String(n).padStart(2, '0');
          const currentStart = `${pad(block.startHour)}:${pad(block.startMinute)}`;
          const currentEnd = `${pad(block.endHour)}:${pad(block.endMinute)}`;
          const suggestedStart = `${pad(t.startHour)}:${pad(t.startMinute)}`;
          const suggestedEnd = `${pad(t.endHour)}:${pad(t.endMinute)}`;

          // Only suggest if actually different from template
          if (currentStart === suggestedStart && currentEnd === suggestedEnd) continue;

          suggestions.push({
            blockId: block.id,
            templateId: tmpl.id,
            templateName: tmpl.name,
            blockTitle: block.title,
            dayOfWeek: Number(dow),
            dayName: DAYS[Number(dow)],
            currentStart,
            currentEnd,
            suggestedStart,
            suggestedEnd,
            editCount: count,
            // Pre-built suggestion message — framed softly
            message: `It looks like your ${block.title} on ${DAYS[Number(dow)]} usually starts at ${suggestedStart} now.`,
          });
        }
      }
    }

    return suggestions;
  }

  // ── Apply adaptation suggestion ───────────────────────────────────────────
  // User taps "Update template" on the suggestion → applies the adjusted time
  async applyAdaptation(userId: string, blockId: string, dayOfWeek: number) {
    const block = await this.prisma.templateBlock.findUnique({
      where: { id: blockId },
      include: { template: true },
    });
    if (!block || block.template.userId !== userId) throw new ForbiddenException();

    const adjusted = (block.adjustedTimes as any)[String(dayOfWeek)];
    if (!adjusted) throw new NotFoundException('No adjustment data for this day');

    // Apply the adjusted time as the new template default
    await this.prisma.templateBlock.update({
      where: { id: blockId },
      data: {
        startHour: adjusted.startHour,
        startMinute: adjusted.startMinute,
        endHour: adjusted.endHour,
        endMinute: adjusted.endMinute,
        // Clear exception memory for this weekday after applying
        editCounts: { ...(block.editCounts as any), [String(dayOfWeek)]: 0 },
        adjustedTimes: { ...(block.adjustedTimes as any), [String(dayOfWeek)]: undefined },
      },
    });

    return { success: true, message: 'Template updated.' };
  }

  // ── Dismiss adaptation suggestion ─────────────────────────────────────────
  // User taps "Keep as is" — reset edit count so it stops surfacing
  async dismissAdaptation(userId: string, blockId: string, dayOfWeek: number) {
    const block = await this.prisma.templateBlock.findUnique({
      where: { id: blockId },
      include: { template: true },
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