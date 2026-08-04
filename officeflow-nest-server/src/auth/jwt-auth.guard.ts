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
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  sub: number;
  sid: string;
  role: UserRole;
};

type AuthRequest = Request & {
  user?: CurrentUserPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        algorithms: ['HS256'],
        issuer: 'officeflow-api',
        audience: 'officeflow-web',
      });

      if (
        !Number.isInteger(payload.sub) ||
        typeof payload.sid !== 'string' ||
        payload.sid.length === 0
      ) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const session = await this.prisma.refreshToken.findUnique({
        where: { id: payload.sid },
        select: {
          userId: true,
          usedAt: true,
          revokedAt: true,
          expiresAt: true,
          user: {
            select: {
              role: true,
              isActive: true,
            },
          },
        },
      });

      if (
        !session ||
        session.userId !== payload.sub ||
        session.usedAt ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive
      ) {
        throw new UnauthorizedException('Session is no longer active');
      }

      request.user = {
        userId: payload.sub,
        role: session.user.role,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
