import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DashboardService } from './dashboard.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  ticket: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  ticketCategory: {
    findMany: jest.fn(),
  },
};

const mockRedis = {
  isReady: jest.fn(),
  getDashboardVersion: jest.fn(),
  key: jest.fn((...parts: Array<string | number>) =>
    ['officeflow:test', ...parts].join(':'),
  ),
  getJson: jest.fn(),
  setJson: jest.fn(),
};

describe('DashboardService Redis cache', () => {
  let service: DashboardService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockRedis.key.mockImplementation((...parts: Array<string | number>) =>
      ['officeflow:test', ...parts].join(':'),
    );
    service = new DashboardService(
      mockPrisma as unknown as PrismaService,
      mockRedis as unknown as RedisService,
    );
  });

  it('returns a versioned, role-scoped cache hit without querying tickets', async () => {
    const cached = {
      totalTickets: 8,
      openTickets: 2,
      inProgressTickets: 2,
      resolvedTickets: 2,
      closedTickets: 1,
      overdueTickets: 1,
    };
    mockRedis.isReady.mockReturnValue(true);
    mockRedis.getDashboardVersion.mockResolvedValue(7);
    mockRedis.getJson.mockResolvedValue(cached);

    await expect(
      service.getSummary({ userId: 1, role: UserRole.ADMIN }),
    ).resolves.toEqual(cached);

    expect(mockRedis.getJson).toHaveBeenCalledWith(
      'officeflow:test:dashboard:report-v1:data-v7:summary:all',
    );
    expect(mockPrisma.ticket.count).not.toHaveBeenCalled();
    expect(mockRedis.setJson).not.toHaveBeenCalled();
  });

  it('queries the database on a miss and stores JSON with a bounded TTL', async () => {
    mockRedis.isReady.mockReturnValue(true);
    mockRedis.getDashboardVersion.mockResolvedValue(2);
    mockRedis.getJson.mockResolvedValue(null);
    mockRedis.setJson.mockResolvedValue(undefined);
    mockPrisma.ticket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { id: 3 } },
      { status: 'IN_PROGRESS', _count: { id: 4 } },
      { status: 'RESOLVED', _count: { id: 2 } },
      { status: 'CLOSED', _count: { id: 2 } },
      { status: 'CANCELLED', _count: { id: 1 } },
    ]);
    mockPrisma.ticket.count.mockResolvedValue(1);

    const result = await service.getSummary({
      userId: 10,
      role: UserRole.EMPLOYEE,
    });

    expect(result).toEqual({
      totalTickets: 12,
      openTickets: 3,
      inProgressTickets: 4,
      resolvedTickets: 2,
      closedTickets: 2,
      overdueTickets: 1,
    });
    expect(mockPrisma.ticket.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.ticket.count).toHaveBeenCalledWith({
      where: { createdById: 10, isOverdue: true },
    });
    expect(mockRedis.setJson).toHaveBeenCalledWith(
      'officeflow:test:dashboard:report-v1:data-v2:summary:employee:10',
      result,
      60,
    );
    expect(mockPrisma.ticket.groupBy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the database when a Redis read fails', async () => {
    mockRedis.isReady.mockReturnValue(true);
    mockRedis.getDashboardVersion.mockRejectedValue(
      new Error('Redis unavailable'),
    );
    mockPrisma.ticket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { id: 3 } },
    ]);

    await expect(
      service.getTicketsByStatus({ userId: 1, role: UserRole.IT_STAFF }),
    ).resolves.toEqual([{ status: 'OPEN', total: 3 }]);

    expect(mockPrisma.ticket.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(mockRedis.setJson).not.toHaveBeenCalled();
  });

  it('keys manager reports by the current department scope', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ departmentId: 4 });
    mockRedis.isReady.mockReturnValue(true);
    mockRedis.getDashboardVersion.mockResolvedValue(9);
    mockRedis.getJson.mockResolvedValue([]);

    await service.getTicketsByPriority({ userId: 22, role: UserRole.MANAGER });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 22 },
      select: { departmentId: true },
    });
    expect(mockRedis.getJson).toHaveBeenCalledWith(
      'officeflow:test:dashboard:report-v1:data-v9:priority:department:4',
    );
    expect(mockPrisma.ticket.groupBy).not.toHaveBeenCalled();
  });
});
