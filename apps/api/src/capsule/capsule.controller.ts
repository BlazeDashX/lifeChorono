import {
  Controller, Get, Post, Patch,
  Body, Param, UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapsuleLetterService } from './capsule-letter.service';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('capsule')
export class CapsuleController {
  constructor(
    private readonly capsule: CapsuleLetterService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /capsule/answers
   * Save the two sealed Day-1 answers from onboarding.
   * Idempotent — safe to call again; returns existing if already saved.
   */
  @Post('answers')
  @HttpCode(HttpStatus.OK)
  async saveAnswers(
    @Request() req,
    @Body() body: { whoAreYou: string; whoWillYou: string },
  ) {
    return this.capsule.saveSealedAnswers(
      req.user.sub,
      (body.whoAreYou ?? '').trim(),
      (body.whoWillYou ?? '').trim(),
    );
  }

  /**
   * GET /capsule/letters
   * All letters for this user, newest first.
   * Used by the /reflections archive page.
   */
  @Get('letters')
  async getLetters(@Request() req) {
    return this.capsule.getLetters(req.user.sub);
  }

  /**
   * GET /capsule/unread
   * Returns the oldest unread letter, or null if none waiting.
   * Frontend checks this on app load to decide whether to show the letter view.
   */
  @Get('unread')
  async getUnread(@Request() req) {
    return this.capsule.getUnreadLetter(req.user.sub);
  }

  /**
   * PATCH /capsule/letters/:id/read
   * Mark a letter as read.
   * Called the moment the user opens the full-screen letter view.
   */
  @Patch('letters/:id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.capsule.markRead(req.user.sub, id);
  }
}