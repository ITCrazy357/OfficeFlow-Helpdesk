import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async markOverdueTickets() {
    const now = new Date();

    const result = await this.prisma.ticket.updateMany({
      where: {
        dueAt: {
          lt: now,
        },
        isOverdue: false,
        status: {
          notIn: [
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED,
          ],
        },
      },
      data: {
        isOverdue: true,
      },
    });

    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} tickets as overdue`);
    } else {
      this.logger.log('No overdue tickets found');
    }
  }
}
