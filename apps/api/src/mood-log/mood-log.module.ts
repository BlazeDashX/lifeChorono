import { Module } from '@nestjs/common';
import { MoodLogController } from './mood-log.controller';
import { MoodLogService } from './mood-log.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MoodLogController],
  providers: [MoodLogService],
  exports: [MoodLogService], 
})
export class MoodLogModule {}