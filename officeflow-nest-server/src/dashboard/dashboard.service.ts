import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const DEFAULT_DASHBOARD_CACHE_TTL_SECONDS = 60;

function getDashboardCacheTtlSeconds() {
  const configured = Number(process.env.DASHBOARD_CACHE_TTL_SECONDS);

  return Number.isInteger(configured) && configured >= 5 && configured <= 300
    ? configured
    : DEFAULT_DASHBOARD_CACHE_TTL_SECONDS;
}

type CurrentUser = {
  userId: number;
  role: UserRole;
};

type DashboardScope = {
  cacheKey: string;
  where: Prisma.TicketWhereInput;
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly cacheTtlSeconds = getDashboardCacheTtlSeconds();
  private readonly inFlightReports = new Map<string, Promise<unknown>>();
  private cacheErrorLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async getTicketScope(
    currentUser: CurrentUser,
  ): Promise<DashboardScope> {
    const where: Prisma.TicketWhereInput = {};

    if (
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.IT_STAFF
    ) {
      return { cacheKey: 'all', where };
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      where.createdById = currentUser.userId;
      return {
        cacheKey: `employee:${currentUser.userId}`,
        where,
      };
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

      return {
        cacheKey: `department:${manager.departmentId}`,
        where,
      };
    }

    throw new ForbiddenException('Forbidden');
  }

  private async getCachedReport<T>(
    report: string,
    currentUser: CurrentUser,
    loadFromDatabase: (where: Prisma.TicketWhereInput) => Promise<T>,
  ): Promise<T> {
    const scope = await this.getTicketScope(currentUser);
    let cacheKey: string | null = null;

    if (this.redis.isReady()) {
      try {
        const version = await this.redis.getDashboardVersion();
        cacheKey = this.redis.key(
          'dashboard',
          'report-v1',
          `data-v${version}`,
          report,
          scope.cacheKey,
        );
        const cached = await this.redis.getJson<T>(cacheKey);

        this.markCacheAvailable();

        if (cached !== null) {
          return cached;
        }
      } catch (error) {
        this.logCacheError(error);
        cacheKey = null;
      }
    }

    const loadKey = cacheKey ?? `database:${report}:${scope.cacheKey}`;
    const existingLoad = this.inFlightReports.get(loadKey) as
      Promise<T> | undefined;

    if (existingLoad) {
      return existingLoad;
    }

    const load = (async () => {
      const result = await loadFromDatabase(scope.where);

      if (cacheKey && this.redis.isReady()) {
        try {
          await this.redis.setJson(cacheKey, result, this.cacheTtlSeconds);
          this.markCacheAvailable();
        } catch (error) {
          this.logCacheError(error);
        }
      }

      return result;
    })();

    this.inFlightReports.set(loadKey, load);

    try {
      return await load;
    } finally {
      if (this.inFlightReports.get(loadKey) === load) {
        this.inFlightReports.delete(loadKey);
      }
    }
  }

  private logCacheError(error: unknown) {
    if (this.cacheErrorLogged) {
      return;
    }

    this.cacheErrorLogged = true;
    const detail = error instanceof Error ? `: ${error.message}` : '';
    this.logger.warn(`Dashboard cache unavailable; using database${detail}`);
  }

  private markCacheAvailable() {
    if (this.cacheErrorLogged) {
      this.cacheErrorLogged = false;
      this.logger.log('Dashboard cache restored');
    }
  }

  async getSummary(currentUser: CurrentUser) {
    return this.getCachedReport('summary', currentUser, async (where) => {
      const [ticketsByStatus, overdueTickets] = await Promise.all([
        this.getTicketsByStatus(currentUser),
        this.prisma.ticket.count({
          where: {
            ...where,
            isOverdue: true,
          },
        }),
      ]);

      const statusCounts = new Map(
        ticketsByStatus.map((item) => [item.status, item.total]),
      );
      const totalTickets = ticketsByStatus.reduce(
        (total, item) => total + item.total,
        0,
      );

      return {
        totalTickets,
        openTickets: statusCounts.get(TicketStatus.OPEN) ?? 0,
        inProgressTickets: statusCounts.get(TicketStatus.IN_PROGRESS) ?? 0,
        resolvedTickets: statusCounts.get(TicketStatus.RESOLVED) ?? 0,
        closedTickets: statusCounts.get(TicketStatus.CLOSED) ?? 0,
        overdueTickets,
      };
    });
  }

  async getTicketsByStatus(currentUser: CurrentUser) {
    return this.getCachedReport('status', currentUser, async (where) => {
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
    });
  }

  async getTicketsByPriority(currentUser: CurrentUser) {
    return this.getCachedReport('priority', currentUser, async (where) => {
      const result = await this.prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: {
          id: true,
        },
      });

      return result.map((item) => ({
        priority: item.priority,
        total: item._count.id,
      }));
    });
  }

  async getTicketsByCategory(currentUser: CurrentUser) {
    return this.getCachedReport('category', currentUser, async (where) => {
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
    });
  }

  async getTicketByDepartment(currentUser: CurrentUser) {
    return this.getCachedReport('department', currentUser, async (where) => {
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
    });
  }

  async getSlaOverview(currentUser: CurrentUser) {
    const summary = await this.getSummary(currentUser);
    const overdueRate =
      summary.totalTickets === 0
        ? 0
        : Number(
            ((summary.overdueTickets / summary.totalTickets) * 100).toFixed(2),
          );

    return {
      totalTickets: summary.totalTickets,
      overdueTickets: summary.overdueTickets,
      resolvedTickets: summary.resolvedTickets,
      overdueRate,
    };
  }
}
