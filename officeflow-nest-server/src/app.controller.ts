import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    return {
      success: true,
      message: 'OfficeFlow NestJS API is running',
    };
  }

  @Get('db-health')
  async getDbHealth() {
    const departments = await this.prisma.department.findMany();

    return {
      success: true,
      message: 'Database connected successfully',
      data: departments,
    };
  }
}
