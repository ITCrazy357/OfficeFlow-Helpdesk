import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OutboxModule } from './platform/outbox/outbox.module';
import { PasswordRecoveryModule } from './modules/password-recovery/password-recovery.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlaModule } from './modules/sla/sla.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UsersModule } from './modules/users/users.module';
import { TicketCategoriesModule } from './modules/ticket-categories/ticket-categories.module';
import { RedisModule } from './platform/redis/redis.module';
import {
  createRateLimitKeyGenerator,
  getIpTracker,
  getLoginAccountTracker,
  getLoginPairTracker,
  isLoginRequest,
} from './platform/redis/rate-limit.config';
import { ResilientThrottlerStorage } from './platform/redis/resilient-throttler.storage';
import { RedisService } from './platform/redis/redis.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.validation';
import { MetricsModule } from './platform/metrics/metrics.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

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
    OutboxModule,
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
    MetricsModule,
    AiModule,
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
