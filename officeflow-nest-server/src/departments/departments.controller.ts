import { Controller, Get, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Message } from '../common/decorators/message.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @Message('Get departments successfully')
  @ApiOperation({ summary: 'Get all departments' })
  @ApiResponse({ status: 200, description: 'Get departments successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.departmentsService.findAll();
  }
}
