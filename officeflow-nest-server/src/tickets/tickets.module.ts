import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketAccessModule } from './ticket-access.module';
import { TicketQueryService } from './ticket-query.service';
import { TicketWorkflowService } from './ticket-workflow.service';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketCommentService } from './ticket-comment.service';
import { SlaModule } from '../sla/sla.module';
import { TicketFeedbackController } from './ticket-feedback.controller';
import { TicketFeedbackService } from './ticket-feedback.service';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    AuditLogsModule,
    SlaModule,
    TicketAccessModule,
  ],
  controllers: [TicketsController, TicketFeedbackController],
  providers: [
    TicketsService,
    TicketQueryService,
    TicketWorkflowService,
    TicketAttachmentService,
    TicketCommentService,
    TicketFeedbackService,
  ],
})
export class TicketsModule {}
