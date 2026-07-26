import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { TicketsModule } from './tickets/tickets.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaModule } from './sla/sla.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TicketsModule,
    SlaModule,
    DashboardModule,
    KnowledgeModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
