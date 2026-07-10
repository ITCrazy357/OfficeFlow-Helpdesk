import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}
  //readonly: giá trị được gán một lần, sau đó không thể thay đổi.
  // Nó giúp bảo vệ dữ liệu khỏi việc bị thay đổi ngoài ý muốn, đảm bảo tính toàn vẹn của dữ liệu trong ứng dụng.
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
