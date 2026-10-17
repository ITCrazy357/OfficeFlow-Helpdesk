import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { LeavePlanningService } from './leave-planning.service';
import {
  LeaveBalanceQueryDto,
  LeaveCalendarQueryDto,
  LeavePreviewDto,
  SetLeaveEntitlementDto,
} from './dto/leave-planning.dto';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-request')
export class LeavePlanningController {
  constructor(private readonly planning: LeavePlanningService) {}

  @Get('balance')
  balance(
    @Query() query: LeaveBalanceQueryDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.planning.getBalance(query, actor);
  }

  @Get('calendar')
  calendar(
    @Query() query: LeaveCalendarQueryDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.planning.calendar(query, actor);
  }

  @Post('preview')
  preview(
    @Body() dto: LeavePreviewDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.planning.preview(dto, actor);
  }

  @Put('entitlements/:userId')
  @Roles(UserRole.ADMIN)
  entitlement(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: LeaveBalanceQueryDto,
    @Body() dto: SetLeaveEntitlementDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.planning.setEntitlement(userId, query.year, dto, actor);
  }
}
