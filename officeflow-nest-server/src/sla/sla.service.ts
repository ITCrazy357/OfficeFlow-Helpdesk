import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketOverdueEvent } from '../notifications/events/ticket-overdue.event';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async markOverdueTickets() {
    const now = new Date();

    const overdueTickets = await this.prisma.ticket.findMany({
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
      select: {
        id: true,
        title: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (overdueTickets.length === 0) {
      this.logger.log('No overdue tickets found');
      return;
    }

    await this.prisma.ticket.updateMany({
      where: {
        id: {
          in: overdueTickets.map((ticket) => ticket.id),
        },
      },
      data: {
        isOverdue: true,
      },
    });

    for (const ticket of overdueTickets) {
      const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
        (id): id is number => Boolean(id),
      );

      this.eventEmitter.emit(
        'ticket.overdue',
        new TicketOverdueEvent(ticket.id, ticket.title, recipientIds),
      );
    }

    this.logger.warn(`Marked ${overdueTickets.length} tickets as overdue`);
  }
}
