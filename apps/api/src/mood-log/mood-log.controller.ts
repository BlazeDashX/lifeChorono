import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';
import { MoodLogService } from './mood-log.service';

@Controller('mood-logs')
@UseGuards(JwtAuthGuard)
export class MoodLogController {
  constructor(private readonly moodLogService: MoodLogService) {}

  /**
   * POST /api/mood-logs
   * Append a new mood log for today.
   * Multiple submissions per day allowed — averaged at read time.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateMoodLogDto) {
    return this.moodLogService.create(req.user.sub, dto);
  }

  /**
   * GET /api/mood-logs/today
   * Returns today's mood summary: avgScore, roundedScore, count, logs[].
   * Returns null (200) if not logged today.
   * Frontend uses this to drive the MoodBanner and MoodModal visibility.
   */
  @Get('today')
  async getTodaySummary(@Request() req) {
    return this.moodLogService.getTodaySummary(req.user.sub);
  }

  /**
   * GET /api/mood-logs
   * All mood logs for the authenticated user, newest first.
   */
  @Get()
  async findAll(@Request() req) {
    return this.moodLogService.findAllByUser(req.user.sub);
  }
}