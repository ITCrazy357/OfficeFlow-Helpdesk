import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Message } from '../common/decorators/message.decorator';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './auth-cookie';
import { TrustedOriginGuard } from './trusted-origin.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(TrustedOriginGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Message('Login successfully')
  @ApiOperation({ summary: 'Login and get access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      loginDto,
      this.getRequestMetadata(request),
    );

    setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Message('Refresh access token successfully')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentRefreshToken = readRefreshCookie(request);

    if (!currentRefreshToken) {
      clearRefreshCookie(response);
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const result = await this.authService.refresh(
        currentRefreshToken,
        this.getRequestMetadata(request),
      );

      setRefreshCookie(
        response,
        result.refreshToken,
        result.refreshTokenExpiresAt,
      );

      return { accessToken: result.accessToken };
    } catch (error) {
      clearRefreshCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Message('Logout successfully')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(readRefreshCookie(request));
    clearRefreshCookie(response);

    return { loggedOut: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard, JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Message('Logout all sessions successfully')
  async logoutAll(
    @CurrentUser('userId') userId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logoutAll(userId);
    clearRefreshCookie(response);

    return { loggedOut: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Message('Get current user successfully')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user' })
  @ApiResponse({ status: 200, description: 'Get current user successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@CurrentUser('userId') userId: number) {
    return this.authService.getMe(userId);
  }

  private getRequestMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
