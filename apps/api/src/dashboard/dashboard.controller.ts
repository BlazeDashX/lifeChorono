import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('week')
  getWeekly(@Request() req, @Query('weekStart') weekStart: string) {
    // If no weekStart provided, default to current week's Monday
    const date = weekStart ? new Date(weekStart) : new Date();
    const day = date.getDay() || 7; 
    if (!weekStart) date.setHours(-24 * (day - 1));
    const startStr = date.toISOString().split('T')[0];
    
    return this.dashboardService.getWeeklyDashboard(req.user.sub, startStr);
  }
}