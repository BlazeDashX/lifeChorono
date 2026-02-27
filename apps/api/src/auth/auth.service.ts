import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  // In-memory set for invalidated refresh tokens 
  private invalidatedTokens = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Email already in use');

    // Hash password with bcrypt (rounds: 12) 
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });

return this.generateTokens(user.id, user.email, user.name, user.isSuperAdmin);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials'); // Return 401 for wrong credentials 

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash); // Verify email + bcrypt compare 
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials'); // Return 401 for wrong credentials 

return this.generateTokens(user.id, user.email, user.name, user.isSuperAdmin);
  }

  async refresh(refreshToken: string) {
    if (this.invalidatedTokens.has(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User not found');

      // Issue new access token 
      const accessToken = this.jwtService.sign(
        { sub: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin },
        { secret: this.config.get<string>('JWT_SECRET') || 'fallback-secret', expiresIn: '15m' }
      );

      return { accessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    // Invalidate refresh token 
    this.invalidatedTokens.add(refreshToken);
    return { message: 'Logged out successfully' };
  }

 private async generateTokens(userId: string, email: string, name: string, isSuperAdmin: boolean) {
    const payload = { sub: userId, email, isSuperAdmin };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET') || 'fallback-secret',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET') || 'fallback-refresh-secret',
        expiresIn: '7d',
      }),
    ]);

  return { accessToken, refreshToken, user: { id: userId, email, name, isSuperAdmin } };
  }
}