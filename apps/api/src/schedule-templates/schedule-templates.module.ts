import { Module } from '@nestjs/common';
import { ScheduleTemplatesController } from './schedule-templates.controller';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleTemplatesController],
  providers: [ScheduleTemplatesService],
  exports: [ScheduleTemplatesService],
})
export class ScheduleTemplatesModule {}
