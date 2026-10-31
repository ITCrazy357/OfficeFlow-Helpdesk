import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';

describe('Ticket result detail contract', () => {
  it.each([null, new Date('2026-10-31T00:00:00Z')])(
    'returns the saved resolution version and confirmation time: %s',
    async (confirmedAt) => {
      const ticket = {
        id: 5,
        createdById: 2,
        createdBy: { id: 2, departmentId: null },
        resolutionVersion: 3,
        confirmedAt,
      };
      const db = {
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket) },
        $transaction: jest.fn(),
      };
      db.$transaction.mockImplementation(
        (work: (tx: typeof db) => Promise<unknown>) => work(db),
      );
      const prisma = db as unknown as PrismaService;
      const service = new TicketQueryService(
        prisma,
        new TicketAccessPolicyService(prisma),
      );
      await expect(
        service.canGetById(5, { userId: 2, role: UserRole.EMPLOYEE }),
      ).resolves.toMatchObject({ resolutionVersion: 3, confirmedAt });
    },
  );
});
