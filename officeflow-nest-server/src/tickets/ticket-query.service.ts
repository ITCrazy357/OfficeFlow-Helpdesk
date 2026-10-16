import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  GetTicketsQueryDto,
  TicketSlaFilter,
  TicketQueue,
} from './dto/get-tickets-query.dto';
import { TicketAccessPolicyService } from './ticket-access-policy.service';

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

    if (query.queue && query.assignedToId) {
      throw new BadRequestException('Use either queue or assignedToId');
    }
    if (query.activeOnly && query.status) {
      throw new BadRequestException('Use either activeOnly or status');
    }

    if (query.queue === TicketQueue.MINE) {
      where.assignedToId = currentUser.userId;
    } else if (query.queue === TicketQueue.UNASSIGNED) {
      where.assignedToId = null;
    } else if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (query.activeOnly) {
      where.status = { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] };
    }

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
          },
          resolutionWarningAt: { lte: now },
        };
      }

      if (query.slaState === TicketSlaFilter.ON_TRACK) {
        where.AND = {
          isOverdue: false,
          status: {
            notIn: TERMINAL_TICKET_STATUSES,
          },
          dueAt: {
            gt: now,
          },
          OR: [
            { resolutionWarningAt: null },
            { resolutionWarningAt: { gt: now } },
          ],
        };
      }
    } else if (typeof query.isOverdue === 'boolean') {
      where.isOverdue = query.isOverdue;
    }

    if (query.keyword) {
      // Preserve manager escalation scope when search adds its own OR clause.
      if (where.OR)
        where.AND = [
          ...(Array.isArray(where.AND)
            ? where.AND
            : where.AND
              ? [where.AND]
              : []),
          { OR: where.OR },
        ];
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
          firstResponseDueAt: true,
          firstRespondedAt: true,
          firstResponseOverdue: true,
          resolutionWarningAt: true,
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

  async getWorkload(currentUser: CurrentUserPayload) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const [users, counts] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: [UserRole.ADMIN, UserRole.IT_STAFF] } },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          isLocked: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.ticket.groupBy({
        by: ['assignedToId', 'status'],
        where: {
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        },
        _count: { id: true },
      }),
    ]);

    const workload = new Map<
      number,
      { openTickets: number; inProgressTickets: number }
    >();
    let unassignedTickets = 0;
    for (const count of counts) {
      if (count.assignedToId === null) {
        unassignedTickets += count._count.id;
        continue;
      }
      const item = workload.get(count.assignedToId) ?? {
        openTickets: 0,
        inProgressTickets: 0,
      };
      if (count.status === TicketStatus.OPEN)
        item.openTickets += count._count.id;
      if (count.status === TicketStatus.IN_PROGRESS)
        item.inProgressTickets += count._count.id;
      workload.set(count.assignedToId, item);
    }

    return {
      unassignedTickets,
      items: users.map((user) => {
        const counts = workload.get(user.id) ?? {
          openTickets: 0,
          inProgressTickets: 0,
        };
        return {
          ...user,
          ...counts,
          totalTickets: counts.openTickets + counts.inProgressTickets,
        };
      }),
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
        firstResponseDueAt: true,
        firstRespondedAt: true,
        firstResponseOverdue: true,
        resolutionWarningAt: true,
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
      firstResponseDueAt: ticket.firstResponseDueAt,
      firstRespondedAt: ticket.firstRespondedAt,
      firstResponseOverdue: ticket.firstResponseOverdue,
      resolutionWarningAt: ticket.resolutionWarningAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: {
        id: ticket.createdBy.id,
        name: ticket.createdBy.name,
        email: ticket.createdBy.email,
        departmentId: ticket.createdBy.departmentId,
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
