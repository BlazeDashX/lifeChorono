import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RecurringModule } from './recurring/recurring.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';

@Module({
  imports: [
    // This loads your .env variables and makes them available everywhere
    ConfigModule.forRoot({ isGlobal: true }), 
    PrismaModule,
    AuthModule,
    TimeEntriesModule,
    DashboardModule,
    RecurringModule,
    AiInsightsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}