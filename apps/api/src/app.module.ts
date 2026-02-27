import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RecurringModule } from './recurring/recurring.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { UsersModule } from './users/users.module';
import { LifetimeModule } from './lifetime/lifetime.module';
import { SnapshotsModule } from './snapshot/snapshots.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TimeEntriesModule,
    DashboardModule,
    RecurringModule,
    AiInsightsModule,
    UsersModule,
    LifetimeModule,
    SnapshotsModule,
  ],
})
export class AppModule {}