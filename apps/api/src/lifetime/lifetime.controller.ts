import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { LifetimeService } from './lifetime.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lifetime')
@UseGuards(JwtAuthGuard)
export class LifetimeController {
  constructor(private readonly lifetimeService: LifetimeService) {}

  @Get('stats')
  getStats(@Request() req) {
    return this.lifetimeService.getStats(req.user.sub);
  }

  @Get('monthly')
  getMonthly(@Request() req, @Query('year') year: string) {
    const y = parseInt(year) || new Date().getFullYear();
    return this.lifetimeService.getMonthly(req.user.sub, y);
  }

  @Get('mood-correlation')
  getMoodCorrelation(@Request() req) {
    return this.lifetimeService.getMoodCorrelation(req.user.sub);
  }
}