import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CurrentUser = {
  userId: number;
  role: UserRole;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTicketScopeWhere(
    currentUser: CurrentUser,
  ): Promise<Prisma.TicketWhereInput> {
    const where: Prisma.TicketWhereInput = {};

    if (currentUser.role === UserRole.ADMIN) {
      return where;
    }

    if (currentUser.role === UserRole.IT_STAFF) {
      return where;
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      where.createdById = currentUser.userId;
      return where;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: {
          departmentId: true,
        },
      });

      if (!manager?.departmentId) {
        throw new ForbiddenException('Manager has no department');
      }

      where.createdBy = {
        departmentId: manager.departmentId,
      };

      return where;
    }

    throw new ForbiddenException('Forbidden');
  }

  async getSummary(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      overdueTickets,
    ] = await Promise.all([
      this.prisma.ticket.count({ where }),

      this.prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.OPEN,
        },
      }),

      this.prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.IN_PROGRESS,
        },
      }),

      this.prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.RESOLVED,
        },
      }),

      this.prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.CLOSED,
        },
      }),

      this.prisma.ticket.count({
        where: {
          ...where,
          isOverdue: true,
        },
      }),
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      overdueTickets,
    };
  }

  async getTicketsByStatus(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const result = await this.prisma.ticket.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    return result.map((item) => ({
      status: item.status,
      total: item._count.id,
    }));
  }

  async getTicketsByPriority(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const result = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: {
        id: true,
      },
    });

    return result.map((item) => {
      priority: item.priority;
      total: item._count.id;
    });
  }

  async getTicketsByCategory(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const groupTicket = await this.prisma.ticket.groupBy({
      by: ['categoryId'],
      where,
      _count: {
        id: true,
      },
    });

    const categoryId = groupTicket.flatMap((item) =>
      item.categoryId === null ? [] : [item.categoryId],
    );

    const category = await this.prisma.ticketCategory.findMany({
      where: {
        id: {
          in: categoryId,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const categoryName = new Map(
      category.map((category) => [category.id, category.name]),
    );

    return groupTicket.map((item) => ({
      categoryId: item.categoryId,
      categoryName:
        item.categoryId === null
          ? 'Uncategorized'
          : categoryName.get(item.categoryId),
      total: item._count.id,
    }));
  }

  async getTicketByDepartment(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const tickets = await this.prisma.ticket.findMany({
      where,
      select: {
        createdBy: {
          select: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const departmentMap = new Map<
      number,
      {
        departmentId: number;
        departmentName: string;
        total: number;
      }
    >();

    for (const ticket of tickets) {
      const department = ticket.createdBy.department;

      if (!department) continue;

      const current = departmentMap.get(department.id);

      if (!current) {
        departmentMap.set(department.id, {
          departmentId: department.id,
          departmentName: department.name,
          total: 1,
        });
      } else {
        current.total += 1;
      }
    }
    return Array.from(departmentMap.values());
  }

  async getSlaOverview(currentUser: CurrentUser) {
    const where = await this.getTicketScopeWhere(currentUser);

    const [totalTickets, overdueTickets, resolvedTickets] = await Promise.all([
      this.prisma.ticket.count({ where }),

      this.prisma.ticket.count({
        where: {
          ...where,
          isOverdue: true,
        },
      }),

      this.prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.RESOLVED,
        },
      }),
    ]);

    const overdueRate =
      totalTickets === 0
        ? 0
        : Number(((overdueTickets / totalTickets) * 100).toFixed(2));

    return {
      totalTickets,
      overdueTickets,
      resolvedTickets,
      overdueRate,
    };
  }
}
