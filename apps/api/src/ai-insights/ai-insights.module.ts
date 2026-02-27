import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsController } from './ai-insights.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiInsightsController],
  providers: [AiInsightsService],
})
export class AiInsightsModule {}