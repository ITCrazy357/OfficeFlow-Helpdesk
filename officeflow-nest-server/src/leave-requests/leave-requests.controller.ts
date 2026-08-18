import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import {
  GetLeaveRequestDto,
  LeaveRequestPaginationQueryDto,
} from './dto/get-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestService } from './leave-requests.service';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-request')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Get('me')
  @Message('Get my leave requests successfully')
  @ApiOperation({ summary: 'Get leave requests created by the current user' })
  @ApiResponse({ status: 200, description: 'Get leave requests successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMine(
    @Query() query: GetLeaveRequestDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.findMine(currentUser, query);
  }

  @Get('pending-approval')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @Message('Get pending leave requests successfully')
  @ApiOperation({
    summary: 'Get pending leave requests assigned to the current approver',
  })
  @ApiResponse({
    status: 200,
    description: 'Get pending leave requests successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findPendingApproval(
    @Query() query: LeaveRequestPaginationQueryDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.findPendingApproval(currentUser, query);
  }

  @Get(':id')
  @Message('Get leave request successfully')
  @ApiOperation({
    summary: 'Get a leave request owned by or assigned to the current user',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Get leave request successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.findOne(id, currentUser);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Message('Create leave request successfully')
  @ApiOperation({ summary: 'Create a leave request for the current user' })
  @ApiBody({ type: CreateLeaveRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Create leave request successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid leave dates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Leave dates overlap' })
  @ApiResponse({ status: 422, description: 'Approver is unavailable' })
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.create(dto, currentUser);
  }

  @Patch(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @Message('Approve leave request successfully')
  @ApiOperation({ summary: 'Approve an assigned pending leave request' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Approve leave request successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 409, description: 'Leave request is not pending' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.approve(id, currentUser);
  }

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @Message('Reject leave request successfully')
  @ApiOperation({ summary: 'Reject an assigned pending leave request' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: RejectLeaveRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Reject leave request successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 409, description: 'Leave request is not pending' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.reject(id, dto, currentUser);
  }

  @Patch(':id/cancel')
  @Message('Cancel leave request successfully')
  @ApiOperation({ summary: 'Cancel a pending leave request owned by the user' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Cancel leave request successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  @ApiResponse({ status: 409, description: 'Leave request is not pending' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.leaveRequestService.cancel(id, currentUser);
  }
}
