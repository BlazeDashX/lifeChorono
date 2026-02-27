import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateGoalsDto } from './dto/update-goals.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.getMe(req.user.sub);
  }

  @Patch('goals')
  async updateGoals(@Request() req, @Body() dto: UpdateGoalsDto) {
    return this.usersService.updateWeeklyGoals(req.user.sub, dto);
  }
}