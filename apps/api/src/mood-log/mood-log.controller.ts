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
   * Create or update today's mood log for the authenticated user.
   * Returns 201 on both create and upsert (idempotent for same-day resubmission).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateMoodLogDto) {
    return this.moodLogService.create(req.user.sub, dto);
  }

  /**
   * GET /api/mood-logs
   * Return all mood logs for the authenticated user, newest first.
   */
  @Get()
  async findAll(@Request() req) {
    return this.moodLogService.findAllByUser(req.user.sub);
  }

  /**
   * GET /api/mood-logs/today
   * Return today's mood log or null.
   * Frontend uses this to pre-populate the picker on page load.
   */
  @Get('today')
  async findToday(@Request() req) {
    return this.moodLogService.findToday(req.user.sub);
  }
}