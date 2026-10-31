import { type Prisma, UserRole, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketQueue, TicketSlaFilter } from './dto/get-tickets-query.dto';

describe('Ticket queue queries', () => {
  const prisma = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    ticket: {
      findMany: jest.fn<Promise<unknown[]>, [Prisma.TicketFindManyArgs]>(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const database = prisma as unknown as PrismaService;
  const service = new TicketQueryService(
    database,
    new TicketAccessPolicyService(database),
  );
  const admin = { userId: 1, role: UserRole.ADMIN };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma),
    );
  });

  it('combines an unassigned queue with SLA, search and active status filters', async () => {
    await service.getTickets(admin, {
      queue: TicketQueue.UNASSIGNED,
      activeOnly: true,
      slaState: TicketSlaFilter.DUE_SOON,
      keyword: 'VPN',
    });
    const args = prisma.ticket.findMany.mock.calls[0][0];
    expect(args.where?.assignedToId).toBeNull();
    expect(args.where?.status).toEqual({
      in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    });
    expect(args.where?.AND).toHaveProperty('dueAt');
    expect(args.where?.OR).toContainEqual({ title: { contains: 'VPN' } });
  });

  it('uses the authenticated user for the mine queue', async () => {
    await service.getTickets(admin, { queue: TicketQueue.MINE });
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: { assignedToId: 1 },
    });
  });

  it('preserves employee ownership when filtering another assignee', async () => {
    await service.getTickets(
      { userId: 8, role: UserRole.EMPLOYEE },
      { assignedToId: 2 },
    );
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: { createdById: 8, assignedToId: 2 },
    });
  });

  it('preserves manager department scope for an unassigned queue', async () => {
    prisma.user.findUnique.mockResolvedValue({ departmentId: 4 });
    await service.getTickets(
      { userId: 8, role: UserRole.MANAGER },
      { queue: TicketQueue.UNASSIGNED },
    );
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { createdBy: { departmentId: 4 } },
          {
            assignedTo: { managerId: 8 },
            slaAlerts: { some: { kind: 'ESCALATED', managerId: 8 } },
          },
        ],
        assignedToId: null,
      },
    });
  });

  it('rejects ambiguous filters', async () => {
    await expect(
      service.getTickets(admin, { queue: TicketQueue.MINE, assignedToId: 2 }),
    ).rejects.toThrow('either queue');
    await expect(
      service.getTickets(admin, {
        activeOnly: true,
        status: TicketStatus.CLOSED,
      }),
    ).rejects.toThrow('either activeOnly');
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it('includes staff without work and unavailable staff with remaining work', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 1, name: 'Admin', isActive: true, isLocked: false },
      { id: 2, name: 'Locked IT', isActive: true, isLocked: true },
      { id: 3, name: 'Free IT', isActive: true, isLocked: false },
    ]);
    prisma.ticket.groupBy.mockResolvedValue([
      { assignedToId: 1, status: TicketStatus.OPEN, _count: { id: 2 } },
      { assignedToId: 1, status: TicketStatus.IN_PROGRESS, _count: { id: 3 } },
      { assignedToId: 2, status: TicketStatus.OPEN, _count: { id: 1 } },
      { assignedToId: null, status: TicketStatus.OPEN, _count: { id: 4 } },
    ]);
    expect(await service.getWorkload(admin)).toMatchObject({
      unassignedTickets: 4,
      items: [
        { id: 1, openTickets: 2, inProgressTickets: 3, totalTickets: 5 },
        { id: 2, isLocked: true, totalTickets: 1 },
        { id: 3, totalTickets: 0 },
      ],
    });
    expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        },
      }),
    );
  });

  it.each([UserRole.EMPLOYEE, UserRole.MANAGER])(
    'denies workload visibility to %s',
    async (role) => {
      await expect(service.getWorkload({ userId: 8, role })).rejects.toThrow(
        'Forbidden',
      );
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );
});
