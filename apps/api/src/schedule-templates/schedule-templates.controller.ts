import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { CreateTemplateDto, UpdateTemplateDto, ConfirmGhostDto } from './dto/schedule-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('schedule-templates')
export class ScheduleTemplatesController {
  constructor(private readonly svc: ScheduleTemplatesService) {}

  // Templates CRUD
  @Get()     findAll(@Request() req) { return this.svc.findAll(req.user.sub); }
  @Post()    create(@Request() req, @Body() dto: CreateTemplateDto) { return this.svc.create(req.user.sub, dto); }
  @Patch(':id') update(@Request() req, @Param('id') id: string, @Body() dto: UpdateTemplateDto) { return this.svc.update(req.user.sub, id, dto); }
  @Delete(':id') remove(@Request() req, @Param('id') id: string) { return this.svc.remove(req.user.sub, id); }

  // Ghost endpoints
  @Get('ghosts')
  getGhosts(@Request() req, @Query('date') date: string) {
    return this.svc.getOrCreateGhosts(req.user.sub, date);
  }
  @Post('ghosts/:id/confirm')
  confirmGhost(@Request() req, @Param('id') id: string, @Body() dto: ConfirmGhostDto) {
    return this.svc.confirmGhost(req.user.sub, id, dto);
  }
  @Post('ghosts/:id/dismiss')
  dismissGhost(@Request() req, @Param('id') id: string) {
    return this.svc.dismissGhost(req.user.sub, id);
  }

  // Adaptation suggestions
  @Get('adaptations') getAdaptations(@Request() req) { return this.svc.getAdaptationSuggestions(req.user.sub); }
  @Post('adaptations/:blockId/apply')   applyAdaptation(@Request() req, @Param('blockId') b: string, @Body('dayOfWeek') d: number) { return this.svc.applyAdaptation(req.user.sub, b, d); }
  @Post('adaptations/:blockId/dismiss') dismissAdaptation(@Request() req, @Param('blockId') b: string, @Body('dayOfWeek') d: number) { return this.svc.dismissAdaptation(req.user.sub, b, d); }
}