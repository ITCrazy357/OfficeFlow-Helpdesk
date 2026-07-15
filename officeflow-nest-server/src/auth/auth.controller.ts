import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { HttpCode, HttpStatus } from '@nestjs/common';
import { Message } from '../common/decorators/message.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Message('Register successfully')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Register successfully' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Message('Login successfully')
  @ApiOperation({ summary: 'Login and get access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Login successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
}
