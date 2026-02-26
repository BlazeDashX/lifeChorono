import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeEntryDto, UpdateTimeEntryDto } from './dto/time-entry.dto';

@Injectable()
export class TimeEntriesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTimeEntryDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    
    // Core duration logic from your guide
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (durationMinutes < 1) throw new BadRequestException('Min 1 minute');
    if (durationMinutes > 1440) throw new BadRequestException('Max 24 hours');

    // Extract just the date (YYYY-MM-DD) for grouping purposes
    const date = new Date(start.toISOString().split('T')[0]);

    return this.prisma.timeEntry.create({
      data: {
        userId,
        title: dto.title,
        category: dto.category,
        subCategory: dto.subCategory,
        startTime: start,
        endTime: end,
        durationMinutes,
        date,
        note: dto.note,
        isRecurring: !!dto.recurringTaskId,
        recurringTaskId: dto.recurringTaskId,
      },
    });
  }

  async getByDate(userId: string, dateString: string) {
    const targetDate = new Date(dateString);
    return this.prisma.timeEntry.findMany({
      where: { userId, date: targetDate },
      orderBy: { startTime: 'asc' },
    });
  }

  async getByWeek(userId: string, weekStartString: string) {
    const start = new Date(weekStartString);
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Add 6 days to get the full 7-day week

    return this.prisma.timeEntry.findMany({
      where: { 
        userId, 
        date: { gte: start, lte: end } 
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateTimeEntryDto) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.userId !== userId) throw new ForbiddenException('Access denied');

    let durationMinutes = entry.durationMinutes;
    let newDate = entry.date;

    // Recalculate if time changes
    if (dto.startTime || dto.endTime) {
      const start = dto.startTime ? new Date(dto.startTime) : entry.startTime;
      const end = dto.endTime ? new Date(dto.endTime) : entry.endTime;
      
      durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      if (durationMinutes < 1) throw new BadRequestException('Min 1 minute');
      if (durationMinutes > 1440) throw new BadRequestException('Max 24 hours');
      
      newDate = new Date(start.toISOString().split('T')[0]);
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...dto,
        durationMinutes,
        date: newDate,
      },
    });
  }

  async delete(userId: string, id: string) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.userId !== userId) throw new ForbiddenException('Access denied'); // Verify ownership

    await this.prisma.timeEntry.delete({ where: { id } });
    return { success: true };
  }
}