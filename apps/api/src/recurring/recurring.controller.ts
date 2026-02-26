import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateRecurringDto) {
    return this.recurringService.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.recurringService.findAll(req.user.sub);
  }

  @Get('suggestions')
  getSuggestions(@Request() req, @Query('date') date: string) {
    return this.recurringService.getSuggestions(req.user.sub, date);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateRecurringDto) {
    return this.recurringService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.recurringService.remove(req.user.sub, id);
  }
}