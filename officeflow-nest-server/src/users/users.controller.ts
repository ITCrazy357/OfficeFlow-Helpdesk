import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { AccountService } from './accounts.service';
import { UsersService } from './users.service';
import { clearRefreshCookie } from '../auth/auth-cookie';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowPasswordChangeRequired } from '../common/decorators/allow-password-change-required.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

import { ChangeAccountLockDto } from './dto/change-account-lock.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountService: AccountService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @Message('Create user successfully')
  @ApiOperation({ summary: 'Create an internal user account' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Get users successfully')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Get users successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Only ADMIN or IT_STAFF can access this API',
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Message('Update user successfully')
  @ApiOperation({ summary: 'Update user information' })
  @ApiParam({ name: 'id', example: 1 })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @Message('Change user activation status successfully')
  @ApiOperation({ summary: 'Activate or deactivate an organization user' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'User activation status changed' })
  @ApiResponse({ status: 403, description: 'Operation is not permitted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  changeActivationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() changeUserStatusDto: ChangeUserStatusDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.usersService.changeActivationStatus(
      id,
      changeUserStatusDto,
      currentUser,
    );
  }

  @Patch(':id/lock-status')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Message('Change account lock status successfully')
  @ApiOperation({ summary: 'Temporarily lock or unlock a user account' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Account lock status changed' })
  @ApiResponse({ status: 403, description: 'Operation is not permitted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Account state changed' })
  changeAccountLock(
    @Param('id', ParseIntPipe) id: number,
    @Body() changeAccountLockDto: ChangeAccountLockDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return changeAccountLockDto.isLocked
      ? this.accountService.lockUser(currentUser, id)
      : this.accountService.unlockUser(currentUser, id);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN, UserRole.IT_STAFF)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Message('Reset user password successfully')
  @ApiOperation({ summary: 'Set a new password for a user' })
  @ApiParam({ name: 'id', example: 1 })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() resetUserPasswordDto: ResetUserPasswordDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.accountService.resetPassword(
      id,
      resetUserPasswordDto,
      currentUser,
    );
  }

  @Patch('me/password')
  @AllowPasswordChangeRequired()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Message('Change my password successfully')
  @ApiOperation({ summary: "Change the current user's password" })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({
    status: 400,
    description: 'Current or new password is invalid',
  })
  @ApiResponse({ status: 409, description: 'Password changed concurrently' })
  async changeMyPassword(
    @Body() changeMyPasswordDto: ChangeMyPasswordDto,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accountService.changeOwnPassword(
      changeMyPasswordDto,
      currentUser,
    );

    clearRefreshCookie(response);

    return result;
  }
}
