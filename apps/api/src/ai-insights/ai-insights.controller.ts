import { Controller, Get, Post, Delete, Query, Request, UseGuards } from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai-insights')
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

  // Open — no auth
  @Get('test')
  async testGemini() {
    return this.aiInsightsService.testGeminiConnection();
  }

  // Dashboard — current week insight
  @UseGuards(JwtAuthGuard)
  @Get('current-week')
  async getCurrentWeek(@Request() req) {
    return this.aiInsightsService.getCurrentWeekInsight(req.user.sub);
  }

  // Dashboard — force regenerate current week
  @UseGuards(JwtAuthGuard)
  @Delete('reset')
  async resetCurrentWeek(@Request() req) {
    return this.aiInsightsService.resetCurrentWeek(req.user.sub);
  }

  // Analytics — weekly history (returns 4 weeks with insight or null)
  @UseGuards(JwtAuthGuard)
  @Get('weekly-history')
  async getWeeklyHistory(@Request() req) {
    return this.aiInsightsService.getWeeklyHistory(req.user.sub);
  }

  // Analytics — generate a specific past week on demand
  @UseGuards(JwtAuthGuard)
  @Post('generate-week')
  async generateWeek(@Request() req, @Query('weeksBack') weeksBack: string) {
    return this.aiInsightsService.generateWeekInsight(req.user.sub, parseInt(weeksBack));
  }

  // Analytics — monthly history (returns 3 months with insight or null)
  @UseGuards(JwtAuthGuard)
  @Get('monthly-history')
  async getMonthlyHistory(@Request() req) {
    return this.aiInsightsService.getMonthlyHistory(req.user.sub);
  }

  // Analytics — generate a specific past month on demand
  @UseGuards(JwtAuthGuard)
  @Post('generate-month')
  async generateMonth(@Request() req, @Query('monthsBack') monthsBack: string) {
    return this.aiInsightsService.generateMonthInsight(req.user.sub, parseInt(monthsBack));
  }
}