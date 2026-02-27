import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto, UpdateTimeEntryDto } from './dto/time-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Adjust path if needed

@UseGuards(JwtAuthGuard) // Protect ALL routes in this controller
@Controller('entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateTimeEntryDto) {
    return this.timeEntriesService.create(req.user.sub, dto);
  }

  @Get()
  getEntries(
    @Request() req, 
    @Query('date') date?: string, 
    @Query('weekStart') weekStart?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    if (date) {
      return this.timeEntriesService.getByDate(req.user.sub, date);
    } else if (weekStart) {
      return this.timeEntriesService.getByWeek(req.user.sub, weekStart);
    } else if (startDate && endDate) {
      return this.timeEntriesService.getByDateRange(req.user.sub, startDate, endDate);
    }
    return []; // Fallback
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    return this.timeEntriesService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  delete(@Request() req, @Param('id') id: string) {
    return this.timeEntriesService.delete(req.user.sub, id);
  }
}