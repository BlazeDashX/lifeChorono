import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface WeeklyGoals {
  productive: number;
  leisure: number;
  restoration: number;
  neutral: number;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateWeeklyGoals(userId: string, goals: WeeklyGoals) {
    const total = goals.productive + goals.leisure + goals.restoration + goals.neutral;

    if (total > 168) {
      throw new BadRequestException(
        `Total hours cannot exceed 168. Current sum: ${total}`
      );
    }

    if (Object.values(goals).some(v => v < 0)) {
      throw new BadRequestException('Goal values cannot be negative');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { weeklyGoals: goals as unknown as Record<string, number> },
      select: {
        id: true,
        email: true,
        name: true,
        weeklyGoals: true,
      },
    });

    return user;
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        weeklyGoals: true,
        timezone: true,
        createdAt: true,
      },
    });
  }
}