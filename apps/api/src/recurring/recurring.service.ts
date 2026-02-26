import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';

@Injectable()
export class RecurringService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringDto) {
    return this.prisma.recurringTask.create({
      data: { ...dto, userId },
    });
  }

  async findAll(userId: string) {
    return this.prisma.recurringTask.findMany({ where: { userId } });
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto) {
    const task = await this.prisma.recurringTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.recurringTask.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.recurringTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.recurringTask.delete({ where: { id } });
    return { success: true };
  }

  async getSuggestions(userId: string, dateString: string) {
    const date = new Date(dateString);
    const dayNum = date.getUTCDay(); // 0=Sun, 1=Mon...

    // Find active templates scheduled for this day of week
    const templates = await this.prisma.recurringTask.findMany({
      where: { userId, isActive: true, daysOfWeek: { has: dayNum } },
    });

    if (!templates.length) return [];

    // Find entries already logged today that belong to these templates
    const alreadyLogged = await this.prisma.timeEntry.findMany({
      where: { 
        userId, 
        date, 
        recurringTaskId: { in: templates.map(t => t.id) } 
      },
      select: { recurringTaskId: true }
    });

    const loggedIds = new Set(alreadyLogged.map(e => e.recurringTaskId));

    // Return only the templates that haven't been logged yet today
    return templates.filter(t => !loggedIds.has(t.id));
  }
}
