import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import { ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
          statusCode?: number;
        };
        //Validate
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
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Duplicate value violates unique constraint';
      }

      if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Record not found';
      }

      if (exception.code === 'P2003') {
        statusCode = HttpStatus.BAD_REQUEST;
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
    };

    if (process.env.NODE_ENV !== 'production') {
      console.error(exception);
    }

    return response.status(statusCode).json(errorResponse);
  }
}
