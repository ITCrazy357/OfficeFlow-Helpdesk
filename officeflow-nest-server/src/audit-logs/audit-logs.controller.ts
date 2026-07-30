import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Message } from '../common/decorators/message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Message('Get audit logs successfully')
  @ApiOperation({
    summary: 'Get audit logs with pagination and filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Get audit logs successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN can access audit logs',
  })
  findAll(@Query() query: GetAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get(':id')
  @Message('Get audit log successfully')
  @ApiOperation({ summary: 'Get audit log detail' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Get audit log successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log not found',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.auditLogsService.findOne(id);
  }
}
