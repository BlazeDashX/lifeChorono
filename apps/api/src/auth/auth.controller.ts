import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register') // POST /api/auth/register 
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login') // POST /api/auth/login 
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh') // POST /api/auth/refresh 
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout') // POST /api/auth/logout 
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me') // GET /api/auth/me 
  getProfile(@Request() req) {
    return req.user; // Return current user from JWT payload 
  }
}