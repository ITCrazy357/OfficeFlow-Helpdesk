import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesGuard } from '../common/guards/roles.guard';

import { LeaveRequestController } from './leave-requests.controller';
import { LeaveRequestService } from './leave-requests.service';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService, RolesGuard],
})
export class LeaveRequestsModule {}
