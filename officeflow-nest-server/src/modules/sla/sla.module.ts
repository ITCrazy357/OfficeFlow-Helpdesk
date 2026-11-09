import { Module } from '@nestjs/common';
import { SlaService } from './sla.service';
import { SlaPolicyService } from './sla-policy.service';
import { SlaController } from './sla.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [SlaController],
  providers: [SlaService, SlaPolicyService],
  exports: [SlaPolicyService],
})
export class SlaModule {}
