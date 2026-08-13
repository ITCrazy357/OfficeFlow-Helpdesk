import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AssetEmailListener } from './listeners/asset-email.listener';
import { TicketEmailListener } from './listeners/ticket-email.listener';
import { UserEmailListener } from './listeners/user-email.listener';
import { MailService } from './mail.service';

@Module({
  imports: [PrismaModule],
  providers: [
    MailService,
    AssetEmailListener,
    TicketEmailListener,
    UserEmailListener,
  ],
  exports: [MailService],
})
export class MailModule {}
