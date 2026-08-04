import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtAuthGuard } from './jwt-auth.guard';
import { TrustedOriginGuard } from './trusted-origin.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;

        if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
          throw new Error(
            'JWT_ACCESS_SECRET must contain at least 32 random bytes',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: '15m',
            algorithm: 'HS256',
            issuer: 'officeflow-api',
            audience: 'officeflow-web',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, TrustedOriginGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
