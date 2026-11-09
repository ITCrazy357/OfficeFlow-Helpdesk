import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { LeaveNotificationsListener } from './listeners/leave-notifications.listener';
import { NotificationsService } from './notifications.service';
import { TicketAccessModule } from '../tickets/ticket-access.module';

@Module({
  imports: [AuthModule, TicketAccessModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListener,
    LeaveNotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
