// FILE: apps/api/src/schedule-templates/schedule-templates.module.ts
// Make sure ScheduleTemplatesService is in exports[] so RoutineModule can inject it.

import { Module } from '@nestjs/common';
import { ScheduleTemplatesController } from './schedule-templates.controller';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [ScheduleTemplatesController],
  providers:   [ScheduleTemplatesService],
  exports:     [ScheduleTemplatesService],   // ← must be exported for RoutineModule
})
export class ScheduleTemplatesModule {}