import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

type JwtPayload = {
  userId: number;
  role: UserRole;
};

type AuthRequest = Request & {
  user?: CurrentUserPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      request.user = {
        userId: payload.userId,
        role: payload.role,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
