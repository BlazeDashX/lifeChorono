import { Injectable } from '@nestjs/common';
import { ScheduleTemplatesService } from '../schedule-templates/schedule-templates.service';

@Injectable()
export class RoutineService {
    constructor(private readonly templatesSvc: ScheduleTemplatesService) { }

    getCatchupPrompt(userId: string, date: string) {
        return this.templatesSvc.getCatchupPrompt(userId, date);
    }

    dismissCatchupBanner(userId: string, forDate: string) {
        return this.templatesSvc.dismissCatchupBanner(userId, forDate);
    }
}
