import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
