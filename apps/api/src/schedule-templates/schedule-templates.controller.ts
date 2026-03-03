import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/schedule-template.dto';

@UseGuards(JwtAuthGuard)
@Controller('schedule-templates')
export class ScheduleTemplatesController {
  constructor(private svc: ScheduleTemplatesService) { }

  @Get()
  findAll(@Request() req) {
    return this.svc.findAll(req.user.sub);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateTemplateDto) {
    return this.svc.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(req.user.sub, id);
  }

  // Ghost endpoints
  @Get('ghosts')
  getGhosts(@Request() req, @Query('date') date: string) {
    return this.svc.getOrCreateGhosts(req.user.sub, date);
  }

  @Post('ghosts/:id/confirm')
  confirmGhost(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.svc.confirmGhost(req.user.sub, id, body);
  }

  @Post('ghosts/:id/dismiss')
  dismissGhost(@Request() req, @Param('id') id: string) {
    return this.svc.dismissGhost(req.user.sub, id);
  }

  // Adaptation suggestions — "your gym usually starts at 6:30 now"
  @Get('adaptations')
  getAdaptations(@Request() req) {
    return this.svc.getAdaptationSuggestions(req.user.sub);
  }
}