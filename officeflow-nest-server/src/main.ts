import 'dotenv/config';

import { NestFactory, Reflector } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //Chỉ giữ lại các thuộc tính được khai báo trong DTO, loại bỏ các thuộc tính không mong muốn
      forbidNonWhitelisted: true, //Nếu có các thuộc tính không mong muốn, sẽ ném ra lỗi
      transform: true, //Tự động chuyển đổi các giá trị đầu vào sang kiểu dữ liệu mong muốn dựa trên các decorator trong DTO
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  app.enableCors({
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('OfficeFlow Helpdesk API')
    .setDescription('NestJS REST API documentation for OfficeFlow Helpdesk')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 5001;
  await app.listen(port);

  console.log(`NestJS API is running on port ${port}`);
}

bootstrap();
