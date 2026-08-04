import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { isAllowedOrigin } from '../common/security/allowed-origins';

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }

      throw new ForbiddenException('Request origin is required');
    }

    if (!isAllowedOrigin(origin)) {
      throw new ForbiddenException('Untrusted request origin');
    }

    return true;
  }
}
