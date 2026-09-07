import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly outboxService: OutboxService,
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

    let markedCount = 0;
    let lastMarkedTicketId: number | null = null;

    for (const ticket of overdueTickets) {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
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

        if (updated.count !== 1) {
          return false;
        }

        const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
          (id): id is number => Boolean(id),
        );

        await this.outboxService.enqueue(tx, {
          type: OUTBOX_EVENT_TYPES.TICKET_OVERDUE,
          payload: {
            ticketId: ticket.id,
            ticketTitle: ticket.title,
            recipientIds,
          },
          deduplicationKey: `ticket-overdue:${ticket.id}`,
        });

        return true;
      });

      // Another worker may have claimed the same ticket after the initial read.
      if (!claimed) {
        continue;
      }

      markedCount++;
      lastMarkedTicketId = ticket.id;
    }

    if (lastMarkedTicketId !== null) {
      await this.eventEmitter.emitAsync(
        DASHBOARD_CACHE_INVALIDATE_EVENT,
        new DashboardCacheInvalidatedEvent(
          'TICKET_OVERDUE',
          lastMarkedTicketId,
        ),
      );
    }

    this.logger.warn(`Marked ${markedCount} tickets as overdue`);
  }
}
