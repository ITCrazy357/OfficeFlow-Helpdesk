import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
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

    let markedCount = 0;
    let lastMarkedTicketId: number | null = null;

    for (const ticket of overdueTickets) {
      const updated = await this.prisma.ticket.updateMany({
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

      // Another worker may have claimed the same ticket after the initial read.
      if (updated.count !== 1) {
        continue;
      }

      markedCount++;
      lastMarkedTicketId = ticket.id;
      const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
        (id): id is number => Boolean(id),
      );

      this.eventEmitter.emit(
        'ticket.overdue',
        new TicketOverdueEvent(ticket.id, ticket.title, recipientIds),
      );
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
