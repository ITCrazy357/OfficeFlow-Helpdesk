import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DepartmentsModule } from './departments/departments.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlaModule } from './sla/sla.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { TicketCategoriesModule } from './ticket-categories/ticket-categories.module';
import { RedisModule } from './redis/redis.module';
import {
  createRateLimitKeyGenerator,
  getIpTracker,
  getLoginAccountTracker,
  getLoginPairTracker,
  isLoginRequest,
} from './redis/rate-limit.config';
import { ResilientThrottlerStorage } from './redis/resilient-throttler.storage';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RedisModule,

    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService, ResilientThrottlerStorage],
      useFactory: (
        redisService: RedisService,
        throttlerStorage: ResilientThrottlerStorage,
      ) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: 120,
          },
          {
            name: 'login-ip',
            ttl: 60_000,
            limit: 20,
            skipIf: (context) => !isLoginRequest(context),
            getTracker: getIpTracker,
          },
          {
            name: 'login-pair',
            ttl: 60_000,
            limit: 5,
            skipIf: (context) => !isLoginRequest(context),
            getTracker: getLoginPairTracker,
          },
          {
            name: 'login-account',
            ttl: 5 * 60_000,
            limit: 10,
            skipIf: (context) => !isLoginRequest(context),
            getTracker: getLoginAccountTracker,
          },
        ],
        storage: throttlerStorage,
        generateKey: createRateLimitKeyGenerator(
          redisService.key('rate-limit'),
        ),
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TicketsModule,
    SlaModule,
    DashboardModule,
    KnowledgeModule,
    LeaveRequestsModule,
    NotificationsModule,
    PasswordRecoveryModule,
    AssetsModule,
    TicketCategoriesModule,
    AuditLogsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
