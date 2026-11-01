import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';

import { PrismaModule } from '../prisma/prisma.module';
import { AssetEmailListener } from './listeners/asset-email.listener';
import { LeaveEmailListener } from './listeners/leave-email.listener';
import { TicketEmailListener } from './listeners/ticket-email.listener';
import { UserEmailListener } from './listeners/user-email.listener';
import { MailService } from './mail.service';
import { TicketAccessModule } from '../tickets/ticket-access.module';
import { EmailDeliveryService } from './email-delivery.service';

@Module({
  imports: [PrismaModule, MetricsModule, TicketAccessModule],
  providers: [
    MailService,
    EmailDeliveryService,
    AssetEmailListener,
    LeaveEmailListener,
    TicketEmailListener,
    UserEmailListener,
  ],
  exports: [MailService],
})
export class MailModule {}
