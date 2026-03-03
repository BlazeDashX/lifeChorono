// FILE: apps/api/src/routine/Routine.module.ts

import { Module } from '@nestjs/common';
import { ScheduleTemplatesModule } from '../schedule-templates/schedule-templates.module';
import { routineController } from './routine.controller';

@Module({
    imports: [ScheduleTemplatesModule],  // shares ScheduleTemplatesService via exports
    controllers: [routineController],
})
export class routineModule { }