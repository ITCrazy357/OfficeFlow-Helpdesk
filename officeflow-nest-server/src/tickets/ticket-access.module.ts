import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketAccessPolicyService } from './ticket-access-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [TicketAccessPolicyService],
  exports: [TicketAccessPolicyService],
})
export class TicketAccessModule {}
