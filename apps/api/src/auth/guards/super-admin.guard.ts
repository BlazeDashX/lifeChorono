import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean { // [cite: 51]
    const req = ctx.switchToHttp().getRequest(); // [cite: 51]
    if (!req.user?.isSuperAdmin) throw new NotFoundException(); // [cite: 51]
    // NotFoundException = 404 not 403 — never reveal the route exists [cite: 51]
    return true; // [cite: 51]
  }
}