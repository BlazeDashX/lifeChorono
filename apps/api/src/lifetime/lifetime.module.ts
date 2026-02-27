import { Module } from '@nestjs/common';
import { LifetimeService } from './lifetime.service';
import { LifetimeController } from './lifetime.controller';

@Module({
  controllers: [LifetimeController],
  providers: [LifetimeService],
})
export class LifetimeModule {}