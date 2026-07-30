import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap, type Observable } from 'rxjs';

import type { CurrentUserPayload } from '../decorators/current-user.decorator';

type AuthRequest = Request & {
  user?: CurrentUserPayload;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthRequest>();
    const response = httpContext.getResponse<Response>();
    const startedAt = Date.now();
    const method = request.method;
    const url = request.originalUrl;
    const userId = request.user?.userId ?? 'guest';
    const ipAddress = request.ip;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;

          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms ` +
              `userId=${userId} ip=${ipAddress}`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startedAt;
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          const stack = error instanceof Error ? error.stack : undefined;

          this.logger.error(
            `${method} ${url} ${statusCode} ${duration}ms ` +
              `userId=${userId} ip=${ipAddress}`,
            stack,
          );
        },
      }),
    );
  }
}
