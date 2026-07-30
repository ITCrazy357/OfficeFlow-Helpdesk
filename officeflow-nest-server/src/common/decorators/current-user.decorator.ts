import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export type CurrentUserPayload = {
  userId: number;
  role: UserRole;
  ipAddress?: string;
  userAgent?: string;
};

type AuthRequest = Request & {
  user?: CurrentUserPayload;
};

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;

    if (!user) return null;

    return data ? user[data] : user;
  },
);
