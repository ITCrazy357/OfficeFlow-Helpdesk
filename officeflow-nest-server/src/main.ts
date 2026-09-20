import 'dotenv/config';

import {
  RequestMethod,
  ValidationPipe,
  ConsoleLogger,
  Logger,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Application, NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics/metrics.service';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

import { isAllowedOrigin } from './common/security/allowed-origins';

import { ConfigService } from '@nestjs/config';
import { requestObservabilityMiddleware } from './common/middleware/request-observability.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: true,
    }),
  });

  app.enableShutdownHooks();
  const metrics = app.get(MetricsService);

  app.use((req: Request, res: Response, next: NextFunction) => {
    requestObservabilityMiddleware(req, res, next, metrics);
  });

  const config = app.get(ConfigService);

  if (process.env.TRUST_PROXY === '1') {
    const expressApp = app.getHttpAdapter().getInstance() as Application;
    expressApp.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //Chỉ giữ lại các thuộc tính được khai báo trong DTO, loại bỏ các thuộc tính không mong muốn
      forbidNonWhitelisted: true, //Nếu có các thuộc tính không mong muốn, sẽ ném ra lỗi
      transform: true, //Tự động chuyển đổi các giá trị đầu vào sang kiểu dữ liệu mong muốn dựa trên các decorator trong DTO
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(metrics));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, !origin || isAllowedOrigin(origin));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OfficeFlow Helpdesk API')
      .setDescription('NestJS REST API documentation for OfficeFlow Helpdesk')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);

  new Logger('Bootstrap').log({ event: 'application_started', port });
}

void bootstrap();
