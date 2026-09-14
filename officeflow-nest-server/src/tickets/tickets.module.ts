import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketWorkflowService } from './ticket-workflow.service';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketCommentService } from './ticket-comment.service';

@Module({
  imports: [AuthModule, CloudinaryModule, AuditLogsModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketAccessPolicyService,
    TicketQueryService,
    TicketWorkflowService,
    TicketAttachmentService,
    TicketCommentService,
  ],
})
export class TicketsModule {}
