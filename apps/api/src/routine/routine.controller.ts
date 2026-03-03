// FILE: apps/api/src/routine/routine.controller.ts

import { Controller, Get, Post, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduleTemplatesService } from '../schedule-templates/schedule-templates.service';

@UseGuards(JwtAuthGuard)
@Controller('routine')
export class routineController {
    constructor(private readonly svc: ScheduleTemplatesService) { }

    /**
     * GET /routine/catchup?date=YYYY-MM-DD
     *
     * Returns whether the "fill yesterday" banner should show.
     * Response shape:
     * {
     *   shouldShow:      boolean
     *   reason:          string   // NO_TEMPLATE | TEMPLATE_TOO_SMALL | NO_ACTIVITY |
     *                             // ENOUGH_COVERAGE | SPARSE_COVERAGE | TOO_OLD | DISMISSED_BY_USER
     *   coveragePct?:    number   // 0–100
     *   coveredMinutes?: number
     *   expectedMinutes?: number
     * }
     */
    @Get('catchup')
    getCatchup(@Request() req: any, @Query('date') date: string) {
        return this.svc.getCatchupPrompt(req.user.sub, date);
    }

    /**
     * POST /routine/catchup/dismiss
     * Body: { forDate: 'YYYY-MM-DD' }
     *
     * Persists dismissal in CatchupDismissal table.
     * Banner will not reappear for this date across any session.
     */
    @Post('catchup/dismiss')
    dismissCatchup(@Request() req: any, @Body('forDate') forDate: string) {
        return this.svc.dismissCatchupBanner(req.user.sub, forDate);
    }
}