import 'dotenv/config';

import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Application } from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { isAllowedOrigin } from './common/security/allowed-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new ResponseInterceptor(app.get(Reflector)),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //Chỉ giữ lại các thuộc tính được khai báo trong DTO, loại bỏ các thuộc tính không mong muốn
      forbidNonWhitelisted: true, //Nếu có các thuộc tính không mong muốn, sẽ ném ra lỗi
      transform: true, //Tự động chuyển đổi các giá trị đầu vào sang kiểu dữ liệu mong muốn dựa trên các decorator trong DTO
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, !origin || isAllowedOrigin(origin));
    },
    credentials: true,
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

  const port = process.env.PORT || 5001;
  await app.listen(port);

  console.log(`NestJS API is running on port ${port}`);
}

void bootstrap();
