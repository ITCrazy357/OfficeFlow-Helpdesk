import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_SLA_POLICY } from './sla-policy';
import { SlaService } from './sla.service';

describe('SLA deadline worker', () => {
  const tx = {
    ticket: { findUnique: jest.fn(), updateMany: jest.fn() },
    slaAlert: { createMany: jest.fn() },
  };
  const prisma = {
    ticket: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const outbox = { enqueue: jest.fn() };
  const events = { emitAsync: jest.fn() };
  let service: SlaService;
  const now = new Date('2026-10-19T08:00:00Z');
  const ticket = () => ({
    id: 1,
    title: 'VPN',
    status: TicketStatus.OPEN,
    createdById: 10,
    assignedToId: 20,
    dueAt: new Date(now.getTime() - 60000),
    firstResponseDueAt: null,
    firstRespondedAt: null,
    responseWarningAt: null,
    resolutionWarningAt: null,
    slaPolicy: null,
    assignedTo: null,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.ticket.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.user.findMany.mockResolvedValue([{ id: 30 }]);
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    tx.ticket.findUnique.mockResolvedValue(ticket());
    tx.ticket.updateMany.mockResolvedValue({ count: 1 });
    tx.slaAlert.createMany.mockResolvedValue({ count: 1 });
    outbox.enqueue.mockResolvedValue({ id: 'event' });
    events.emitAsync.mockResolvedValue([]);
    service = new SlaService(
      prisma as unknown as PrismaService,
      events as unknown as EventEmitter2,
      outbox,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('keeps legacy overdue delivery and notifies only for the winning claim', async () => {
    prisma.ticket.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    tx.ticket.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.markOverdueTickets();
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.overdue',
        payload: { ticketId: 1, ticketTitle: 'VPN', recipientIds: [10, 20] },
      }),
    );
    expect(events.emitAsync).toHaveBeenCalledTimes(1);
  });

  it('escalates to available admins and the assignee manager without reassigning the ticket', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      slaPolicy: DEFAULT_SLA_POLICY,
      assignedTo: {
        manager: {
          id: 40,
          role: UserRole.MANAGER,
          isActive: true,
          isLocked: false,
        },
      },
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.sla_alert',
        payload: {
          ticketId: 1,
          ticketTitle: 'VPN',
          recipientIds: [30, 40],
          milestone: 'RESOLUTION',
          kind: 'ESCALATED',
          dueAt: ticket().dueAt.toISOString(),
        },
      }),
    );
    expect(tx.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isOverdue: true } }),
    );
  });

  it('excludes locked managers from escalation', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      slaPolicy: DEFAULT_SLA_POLICY,
      assignedTo: {
        manager: {
          id: 40,
          role: UserRole.MANAGER,
          isActive: true,
          isLocked: true,
        },
      },
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.sla_alert',
        payload: {
          ticketId: 1,
          ticketTitle: 'VPN',
          recipientIds: [30],
          milestone: 'RESOLUTION',
          kind: 'ESCALATED',
          dueAt: ticket().dueAt.toISOString(),
        },
      }),
    );
  });

  it('deduplicates warnings using a persistent marker', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      slaPolicy: DEFAULT_SLA_POLICY,
      dueAt: new Date(now.getTime() + 60000),
      resolutionWarningAt: new Date(now.getTime() - 60000),
    });
    tx.slaAlert.createMany.mockResolvedValue({ count: 0 });
    await service.markOverdueTickets();
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('sends response warnings separately from resolution warnings', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      slaPolicy: DEFAULT_SLA_POLICY,
      dueAt: new Date(now.getTime() + 3600000),
      firstResponseDueAt: new Date(now.getTime() + 60000),
      responseWarningAt: new Date(now.getTime() - 60000),
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.sla_alert',
        deduplicationKey: 'ticket-sla:1:RESPONSE:WARNING',
      }),
    );
  });

  it('ignores completed tickets and first responses already received', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      status: TicketStatus.RESOLVED,
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('does not alert on a response already received', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      firstRespondedAt: new Date(now.getTime() - 120000),
      firstResponseDueAt: new Date(now.getTime() - 60000),
      dueAt: new Date(now.getTime() + 3600000),
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('records and escalates response breaches separately from resolution', async () => {
    tx.ticket.findUnique.mockResolvedValue({
      ...ticket(),
      slaPolicy: DEFAULT_SLA_POLICY,
      firstResponseDueAt: new Date(now.getTime() - 60000),
      dueAt: new Date(now.getTime() + 3600000),
    });
    await service.markOverdueTickets();
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        deduplicationKey: 'ticket-sla:1:RESPONSE:BREACHED',
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        deduplicationKey: 'ticket-sla:1:RESPONSE:ESCALATED',
      }),
    );
    expect(tx.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { firstResponseOverdue: true } }),
    );
  });

  it('propagates event failure so the transaction rolls back the flag and marker', async () => {
    outbox.enqueue.mockRejectedValueOnce(new Error('outbox failed'));
    await expect(service.markOverdueTickets()).rejects.toThrow('outbox failed');
    expect(events.emitAsync).not.toHaveBeenCalled();
    await service.markOverdueTickets();
    expect(events.emitAsync).toHaveBeenCalledTimes(1);
  });
});
