import { Controller, Get } from '@nestjs/common';

import { Message } from './common/decorators/message.decorator';
import { PrismaService } from './prisma/prisma.service';

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
