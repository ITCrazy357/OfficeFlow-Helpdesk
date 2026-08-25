import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Message('Get dashboard summary successfully')
  @ApiOperation({ summary: 'Get dashboard summary' })
  @ApiResponse({
    status: 200,
    description: 'Get dashboard summary successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSummary(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getSummary(currentUser);
  }

  @Get('tickets-by-status')
  @Message('Get tickets by status successfully')
  @ApiOperation({ summary: 'Get tickets grouped by status' })
  @ApiResponse({
    status: 200,
    description: 'Get tickets by status successfully',
  })
  getTicketsByStatus(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getTicketsByStatus(currentUser);
  }

  @Get('tickets-by-priority')
  @Message('Get tickets by priority successfully')
  @ApiOperation({ summary: 'Get tickets grouped by priority' })
  getTicketsByPriority(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getTicketsByPriority(currentUser);
  }

  @Get('tickets-by-category')
  @Message('Get tickets by category successfully')
  @ApiOperation({ summary: 'Get tickets grouped by category' })
  getTicketsByCategory(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getTicketsByCategory(currentUser);
  }

  @Get('tickets-by-department')
  @Message('Get tickets by department successfully')
  @ApiOperation({ summary: 'Get tickets grouped by department' })
  getTicketsByDepartment(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getTicketByDepartment(currentUser);
  }

  @Get('sla-overview')
  @Message('Get SLA overview successfully')
  @ApiOperation({ summary: 'Get SLA overview' })
  getSlaOverview(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.dashboardService.getSlaOverview(currentUser);
  }
}
