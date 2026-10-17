import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import {
  AssetWarrantyReminderService,
  AssetWarrantyNotificationListener,
} from './asset-warranty-reminder.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, AuditLogsModule, NotificationsModule],
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetMaintenanceService,
    AssetWarrantyReminderService,
    AssetWarrantyNotificationListener,
  ],
  exports: [AssetsService],
})
export class AssetsModule {}
