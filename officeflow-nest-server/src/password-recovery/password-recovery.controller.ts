import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { clearRefreshCookie } from '../auth/auth-cookie';
import { TrustedOriginGuard } from '../auth/trusted-origin.guard';
import { Message } from '../common/decorators/message.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetForgottenPasswordDto } from './dto/reset-forgotten-password.dto';
import { PasswordRecoveryService } from './password-recovery.service';

@ApiTags('Auth')
@Controller('auth')
export class PasswordRecoveryController {
  constructor(
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  private getRequestMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(TrustedOriginGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Message(
    'If an eligible account exists, password reset instructions will be sent',
  )
  @ApiOperation({ summary: 'Request a self-service password reset link' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 202, description: 'Request accepted' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.passwordRecoveryService.forgotPassword(
      dto,
      this.getRequestMetadata(request),
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Message('Password reset successfully')
  @ApiOperation({ summary: 'Set a new password using a one-time token' })
  @ApiBody({ type: ResetForgottenPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(
    @Body() dto: ResetForgottenPasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.passwordRecoveryService.resetPassword(
      dto,
      this.getRequestMetadata(request),
    );

    clearRefreshCookie(response);

    return result;
  }
}
