import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import type { ApiErrorResponse } from '../types/api-response.type';
import {
  getRequestDiagnostics,
  getSafeErrorDetails,
} from '../diagnostics/request-diagnostics';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const { requestId, durationMs } = getRequestDiagnostics(request);
    response.setHeader('X-Request-Id', requestId);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseBody = exceptionResponse as {
          message?: string | string[];
          error?: string;
        };

        if (Array.isArray(responseBody.message)) {
          message = 'Validation failed';
          errors = responseBody.message;
        } else if (typeof responseBody.message === 'string') {
          message = responseBody.message;
        } else if (typeof responseBody.error === 'string') {
          message = responseBody.error;
        }
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Duplicate value violates unique constraint';
      }

      if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Record not found';
      }

      if (exception.code === 'P2003') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Foreign key constraint failed';
      }
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      errors,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId,
    };

    const diagnostic = {
      event: 'http_request_failed',
      requestId,
      method: request.method,
      path: request.path || request.originalUrl.split('?', 1)[0],
      statusCode,
      durationMs,
      ...getSafeErrorDetails(exception),
    };
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR)
      this.logger.error(diagnostic);
    else this.logger.warn(diagnostic);

    return response.status(statusCode).json(errorResponse);
  }
}
