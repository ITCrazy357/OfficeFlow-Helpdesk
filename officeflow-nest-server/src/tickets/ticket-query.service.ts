import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  GetTicketsQueryDto,
  TicketSlaFilter,
} from './dto/get-tickets-query.dto';
import { TicketAccessPolicyService } from './ticket-access-policy.service';

const SLA_DUE_SOON_HOURS = 24;
const TERMINAL_TICKET_STATUSES = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

@Injectable()
export class TicketQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TicketAccessPolicyService,
  ) {}
  async getTickets(currentUser: CurrentUserPayload, query: GetTicketsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where = await this.access.getScope(currentUser);

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.slaState) {
      const now = new Date();
      const dueSoonAt = new Date(
        now.getTime() + SLA_DUE_SOON_HOURS * 60 * 60 * 1000,
      );

      if (query.slaState === TicketSlaFilter.OVERDUE) {
        where.AND = {
          OR: [
            {
              isOverdue: true,
            },
            {
              isOverdue: false,
              dueAt: {
                lte: now,
              },
              status: {
                notIn: TERMINAL_TICKET_STATUSES,
              },
            },
          ],
        };
      }

      if (query.slaState === TicketSlaFilter.DUE_SOON) {
        where.AND = {
          isOverdue: false,
          status: {
            notIn: TERMINAL_TICKET_STATUSES,
          },
          dueAt: {
            gt: now,
            lte: dueSoonAt,
          },
        };
      }

      if (query.slaState === TicketSlaFilter.ON_TRACK) {
        where.AND = {
          isOverdue: false,
          status: {
            notIn: TERMINAL_TICKET_STATUSES,
          },
          dueAt: {
            gt: dueSoonAt,
          },
        };
      }
    } else if (typeof query.isOverdue === 'boolean') {
      where.isOverdue = query.isOverdue;
    }

    if (query.keyword) {
      where.OR = [
        {
          title: {
            contains: query.keyword,
          },
        },
        {
          description: {
            contains: query.keyword,
          },
        },
      ];
    }

    const [tickets, totalItems] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          resolveAt: true,
          isOverdue: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              type: true,
              status: true,
              brand: true,
              model: true,
              serialNumber: true,
            },
          },
        },
      }),

      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: tickets,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async canGetById(id: number, currentUser: CurrentUserPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        resolveAt: true,
        isOverdue: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            type: true,
            status: true,
            brand: true,
            model: true,
            serialNumber: true,
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.access.assertCanView(ticket, currentUser);

    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      dueAt: ticket.dueAt,
      resolveAt: ticket.resolveAt,
      isOverdue: ticket.isOverdue,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: {
        id: ticket.createdBy.id,
        name: ticket.createdBy.name,
        email: ticket.createdBy.email,
      },
      assignedTo: ticket.assignedTo,
      category: ticket.category,
      asset: ticket.asset,
    };
  }

  async getHistory(ticketId: number, currentUser: CurrentUserPayload) {
    await this.access.canAccessTicket(ticketId, currentUser);

    const histories = await this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        action: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return histories;
  }
}
