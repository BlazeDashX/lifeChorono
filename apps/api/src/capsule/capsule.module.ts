import { Module } from '@nestjs/common';
import { CapsuleLetterService } from './capsule-letter.service';
import { CapsuleController } from './capsule.controller';
import { MoodNarrativeService } from './mood-narrative.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  providers:   [CapsuleLetterService, MoodNarrativeService],
  controllers: [CapsuleController],
  exports:     [CapsuleLetterService, MoodNarrativeService],
})
export class CapsuleModule {}