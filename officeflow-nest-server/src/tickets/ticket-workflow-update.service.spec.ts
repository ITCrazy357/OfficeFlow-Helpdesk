import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import type { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import type { OutboxService } from '../outbox/outbox.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SlaPolicyService } from '../sla/sla-policy.service';
import type { TicketQueryService } from './ticket-query.service';
import { TicketWorkflowService } from './ticket-workflow.service';

describe('Ticket information update authorization', () => {
  const employee: CurrentUserPayload = { userId: 7, role: UserRole.EMPLOYEE };
  const staff: CurrentUserPayload = { userId: 3, role: UserRole.IT_STAFF };
  const original = {
    id: 5,
    title: 'VPN issue',
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    updatedAt: new Date('2026-10-30T10:00:00Z'),
    createdById: employee.userId,
    assignedToId: staff.userId as number | null,
    categoryId: null,
    createdBy: { departmentId: 1 },
  };
  const tx = {
    ticket: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    ticketCategory: { findUnique: jest.fn() },
    ticketHistory: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(), ticket: { findUnique: jest.fn() } };
  const audit = { create: jest.fn() };
  const events = new EventEmitter2();
  const emit = jest.spyOn(events, 'emitAsync');
  const service = new TicketWorkflowService(
    prisma as unknown as PrismaService,
    events,
    audit as unknown as AuditLogsService,
    {} as OutboxService,
    {} as TicketQueryService,
    {} as SlaPolicyService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
    );
    tx.ticket.findUnique.mockResolvedValue({ ...original });
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.ticket.findUniqueOrThrow.mockResolvedValue({
      ...original,
      title: 'Updated VPN issue',
      category: null,
    });
    tx.user.findUnique.mockResolvedValue({ departmentId: 1 });
    emit.mockResolvedValue([]);
  });

  it('edits an open owned ticket and commits its history in the same transaction', async () => {
    const result = await service.update(
      5,
      { title: 'Updated VPN issue' },
      employee,
    );
    expect(result.title).toBe('Updated VPN issue');
    expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.ticketHistory.create).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledWith(expect.any(Object), tx);
  });

  it.each([
    ['status', employee],
    ['assignee', staff],
  ] as const)(
    'rejects a concurrent %s change without history or audit',
    async (change, actor) => {
      tx.ticket.updateMany.mockImplementation(
        ({
          where,
        }: {
          where: { status: TicketStatus; assignedToId: number | null };
        }) => {
          const current = {
            ...original,
            ...(change === 'status'
              ? { status: TicketStatus.IN_PROGRESS }
              : { assignedToId: 99 }),
          };
          return Promise.resolve({
            count:
              where.status === current.status &&
              where.assignedToId === current.assignedToId
                ? 1
                : 0,
          });
        },
      );
      await expect(
        service.update(5, { title: 'Updated VPN issue' }, actor),
      ).rejects.toThrow('Ticket changed concurrently');
      expect(tx.ticket.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(tx.ticketHistory.create).not.toHaveBeenCalled();
      expect(audit.create).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    },
  );

  it('rejects an employee edit if processing started before the transaction read', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...original,
      status: TicketStatus.IN_PROGRESS,
    });
    await expect(
      service.update(5, { title: 'Updated VPN issue' }, employee),
    ).rejects.toThrow('Ticket is not open');
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('preserves employee ownership and staff assignment restrictions', async () => {
    await expect(
      service.update(
        5,
        { title: 'Updated VPN issue' },
        { ...employee, userId: 8 },
      ),
    ).rejects.toThrow('Forbidden');
    await expect(
      service.update(
        5,
        { title: 'Updated VPN issue' },
        { ...staff, userId: 4 },
      ),
    ).rejects.toThrow('Forbidden');
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('validates a changed category before writing and invalidates reports after a committed priority change', async () => {
    tx.ticketCategory.findUnique.mockResolvedValue(null);
    await expect(
      service.update(5, { categoryId: 42 }, employee),
    ).rejects.toThrow('Ticket category not found');
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
    tx.ticket.findUniqueOrThrow.mockResolvedValue({
      ...original,
      priority: TicketPriority.HIGH,
      category: null,
    });
    await service.update(5, { priority: TicketPriority.HIGH }, employee);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
