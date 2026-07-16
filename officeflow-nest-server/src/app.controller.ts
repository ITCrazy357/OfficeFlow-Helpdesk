import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Message } from './common/decorators/message.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}
  
  @Get()
  @Message('Welcome to OfficeFlow Helpdesk API')
  getApiInfo() {
    return {
      status: 'ok',
      health: '/api/health',
      documentation: '/api/docs',
    };
  }

  //readonly: giá trị được gán một lần, sau đó không thể thay đổi.
  // Nó giúp bảo vệ dữ liệu khỏi việc bị thay đổi ngoài ý muốn, đảm bảo tính toàn vẹn của dữ liệu trong ứng dụng.
  @Get('health')
  @Message('OfficeFlow NestJS API is running')
  getHealth() {
    return {
      status: 'ok',
    };
  }

  @Get('db-health')
  @Message('Database connected successfully')
  async getDbHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
