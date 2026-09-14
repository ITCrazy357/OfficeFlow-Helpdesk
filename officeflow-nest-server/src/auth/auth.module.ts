import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { TrustedOriginGuard } from './trusted-origin.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
          algorithm: 'HS256',
          issuer: 'officeflow-api',
          audience: 'officeflow-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RefreshTokenCleanupService,
    TrustedOriginGuard,
  ],
  exports: [JwtAuthGuard, JwtModule, TrustedOriginGuard],
})
export class AuthModule {}
