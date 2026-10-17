import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RolesGuard } from '../common/guards/roles.guard';

import { LeaveRequestController } from './leave-requests.controller';
import { LeaveRequestService } from './leave-requests.service';
import { LeavePlanningService } from './leave-planning.service';
import { LeavePlanningController } from './leave-planning.controller';
import { SlaModule } from '../sla/sla.module';

@Module({
  imports: [AuthModule, AuditLogsModule, SlaModule],
  controllers: [LeavePlanningController, LeaveRequestController],
  providers: [LeaveRequestService, LeavePlanningService, RolesGuard],
})
export class LeaveRequestsModule {}
