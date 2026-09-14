import { UserRole } from '@prisma/client';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('TicketAccessPolicyService', () => {
  const prisma = {
    ticket: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const service = new TicketAccessPolicyService(
    prisma as unknown as PrismaService,
  );
  const ticket = { id: 1, createdById: 2, createdBy: { departmentId: 7 } };
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.user.findUnique.mockResolvedValue({ departmentId: 7 });
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
    ).resolves.toEqual({ createdById: 3 });
  });
});
