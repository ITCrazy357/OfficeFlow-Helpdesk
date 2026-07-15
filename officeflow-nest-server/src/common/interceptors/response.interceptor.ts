import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, map } from 'rxjs';

import { RESPONSE_MESSAGE_KEY } from '../decorators/message.decorator';
import { ApiSuccessResponse } from '../types/api-response.type';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data: any) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        const response = context.switchToHttp().getResponse<Response>();

        const message =
          this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
            context.getHandler(),
            context.getClass(),
          ]) || 'Request successful';

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
        };
      }),
    );
  }
}
