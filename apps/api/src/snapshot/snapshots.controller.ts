import { Controller, Post, Query, UseGuards, Request } from '@nestjs/common';
import { SnapshotsService } from './snapshots.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private readonly snapshotsService: SnapshotsService) {}

  // Admin/dev force trigger — POST /api/snapshots/force?weeksBack=0
  @Post('force')
  forceSnapshots(@Query('weeksBack') weeksBack: string) {
    const weeks = parseInt(weeksBack) || 0;
    return this.snapshotsService.forceComputeSnapshots(weeks);
  }
}