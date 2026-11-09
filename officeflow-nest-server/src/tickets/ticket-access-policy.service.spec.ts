import { UserRole, type Prisma } from '@prisma/client';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('TicketAccessPolicyService', () => {
  const prisma = {
    ticket: { findUnique: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
  };
  const service = new TicketAccessPolicyService(
    prisma as unknown as PrismaService,
  );
  const ticket = { id: 1, createdById: 2, createdBy: { departmentId: 7 } };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.user.findUnique.mockResolvedValue({ departmentId: 7 });
    prisma.ticket.count.mockResolvedValue(0);
  });

  it('filters delayed recipients using current roles, ownership and manager scope', async () => {
    const candidates = [
      {
        id: 2,
        name: 'Owner',
        email: 'owner@test.invalid',
        role: UserRole.EMPLOYEE,
      },
      {
        id: 3,
        name: 'Former admin',
        email: 'former@test.invalid',
        role: UserRole.EMPLOYEE,
      },
      {
        id: 9,
        name: 'Admin',
        email: 'admin@test.invalid',
        role: UserRole.ADMIN,
      },
      {
        id: 4,
        name: 'Manager',
        email: 'manager@test.invalid',
        role: UserRole.MANAGER,
      },
    ];
    prisma.user.findMany.mockResolvedValue(candidates);
    const transaction = prisma as unknown as Prisma.TransactionClient;
    expect(
      (await service.getRecipients(1, [2, 3, 9, 4, 2], transaction)).map(
        (user) => user.id,
      ),
    ).toEqual([2, 9, 4]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [2, 3, 9, 4] },
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    prisma.user.findUnique.mockResolvedValue({ departmentId: 8 });
    expect(
      (await service.getRecipients(1, [2, 3, 9, 4], transaction)).map(
        (user) => user.id,
      ),
    ).toEqual([2, 9]);
  });

  it('skips a deleted ticket but propagates database failures for outbox retry', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 3,
        name: 'Former admin',
        email: 'former@test.invalid',
        role: UserRole.EMPLOYEE,
      },
    ]);
    const transaction = prisma as unknown as Prisma.TransactionClient;
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(service.getRecipients(1, [3], transaction)).resolves.toEqual(
      [],
    );
    prisma.ticket.findUnique.mockRejectedValue(
      new Error('fixture database outage'),
    );
    await expect(service.getRecipients(1, [3], transaction)).rejects.toThrow(
      'fixture database outage',
    );
  });
  it.each([UserRole.ADMIN, UserRole.IT_STAFF])(
    'allows %s to access a ticket without a department lookup',
    async (role) => {
      await expect(
        service.canAccessTicket(1, { userId: 9, role }),
      ).resolves.toEqual(ticket);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );
  it('allows an employee only their own ticket', async () => {
    await expect(
      service.canAccessTicket(1, { userId: 2, role: UserRole.EMPLOYEE }),
    ).resolves.toEqual(ticket);
    await expect(
      service.canAccessTicket(1, { userId: 3, role: UserRole.EMPLOYEE }),
    ).rejects.toThrow('Forbidden');
  });
  it('allows a manager in the creator department', async () => {
    await expect(
      service.canAccessTicket(1, { userId: 3, role: UserRole.MANAGER }),
    ).resolves.toEqual(ticket);
  });
  it.each([null, { departmentId: null }, { departmentId: 8 }])(
    'rejects a manager outside the department: %j',
    async (manager) => {
      prisma.user.findUnique.mockResolvedValue(manager);
      await expect(
        service.canAccessTicket(1, { userId: 3, role: UserRole.MANAGER }),
      ).rejects.toThrow('Forbidden');
      await expect(
        service.assertCanView(ticket, { userId: 3, role: UserRole.MANAGER }),
      ).rejects.toThrow('Forbidden');
    },
  );
  it('returns 404 for a missing ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(
      service.canAccessTicket(1, { userId: 2, role: UserRole.EMPLOYEE }),
    ).rejects.toThrow('Ticket not found');
  });
  it('keeps the existing manager-without-department list fallback', async () => {
    prisma.user.findUnique.mockResolvedValue({ departmentId: null });
    await expect(
      service.getScope({ userId: 3, role: UserRole.MANAGER }),
    ).resolves.toEqual({
      OR: [
        { createdById: 3 },
        {
          assignedTo: { managerId: 3 },
          slaAlerts: { some: { kind: 'ESCALATED', managerId: 3 } },
        },
      ],
    });
  });

  it('lets a manager without a department open and discuss their own listed ticket', async () => {
    const actor = { userId: 3, role: UserRole.MANAGER };
    const ownTicket = {
      id: 1,
      createdById: actor.userId,
      createdBy: { departmentId: null },
    };
    prisma.user.findUnique.mockResolvedValue({ departmentId: null });
    prisma.ticket.findUnique.mockResolvedValue(ownTicket);
    expect((await service.getScope(actor)).OR).toContainEqual({
      createdById: actor.userId,
    });
    await expect(
      service.assertCanView(ownTicket, actor),
    ).resolves.toBeUndefined();
    await expect(service.canAccessTicket(1, actor)).resolves.toEqual(ownTicket);
    expect(prisma.ticket.count).not.toHaveBeenCalled();
  });

  it('allows an assigned staff manager to read an explicitly escalated ticket only', async () => {
    prisma.user.findUnique.mockResolvedValue({ departmentId: 8 });
    prisma.ticket.count.mockResolvedValue(1);
    await expect(
      service.canAccessTicket(1, { userId: 3, role: UserRole.MANAGER }),
    ).resolves.toEqual(ticket);
    expect(prisma.ticket.count).toHaveBeenCalledWith({
      where: {
        id: 1,
        assignedTo: { managerId: 3 },
        slaAlerts: { some: { kind: 'ESCALATED', managerId: 3 } },
      },
    });
  });
});
