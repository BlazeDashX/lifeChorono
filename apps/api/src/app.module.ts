import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule }        from './auth/auth.module';
import { PrismaModule }      from './prisma/prisma.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { DashboardModule }   from './dashboard/dashboard.module';
import { RecurringModule }   from './recurring/recurring.module';
import { AiInsightsModule }  from './ai-insights/ai-insights.module';
import { UsersModule }       from './users/users.module';
import { LifetimeModule }    from './lifetime/lifetime.module';
import { MoodLogModule }     from './mood-log/mood-log.module';
import { SnapshotsModule }   from './snapshot/snapshots.module';
import { CapsuleModule }     from './capsule/capsule.module';
import { ScheduleTemplatesModule } from './schedule-templates/schedule-templates.module'; 

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TimeEntriesModule,
    DashboardModule,
    RecurringModule,
    AiInsightsModule,
    UsersModule,
    LifetimeModule,
    MoodLogModule,
    SnapshotsModule,
    CapsuleModule,
    ScheduleTemplatesModule,            
  ],
})
export class AppModule {}