import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class MetricsTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('METRICS_TOKEN');

    //Fail closed, kể cả khi test hoặc cấu hình bỏ qua validation.
    if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization ?? '';
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    const supplied = match?.[1];

    if (
      !supplied ||
      !timingSafeEqual(
        Buffer.from(supplied, 'utf8'),
        Buffer.from(expected, 'utf8'),
      )
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
