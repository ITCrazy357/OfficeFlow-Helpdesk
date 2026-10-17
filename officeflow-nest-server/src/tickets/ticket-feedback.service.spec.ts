import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { TicketFeedbackService } from './ticket-feedback.service';

describe('Requester ticket results and feedback', () => {
  const requester = { userId: 3, role: 'EMPLOYEE' as const };
  const admin = { userId: 1, role: 'ADMIN' as const };
  const ticket = {
    id: 5,
    title: 'VPN',
    status: 'RESOLVED',
    createdById: 3,
    assignedToId: 4,
    resolutionVersion: 2,
  };
  const db = {
    ticket: {
      findUnique: jest.fn(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [Prisma.TicketUpdateManyArgs]
      >(),
    },
    ticketHistory: {
      create: jest.fn<Promise<unknown>, [Prisma.TicketHistoryCreateArgs]>(),
    },
    ticketComment: { create: jest.fn() },
    ticketFeedback: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const tx = db as unknown as Prisma.TransactionClient;
  const access = { canAccessTicket: jest.fn() };
  const audit = { create: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const events = { emitAsync: jest.fn() };
  const service = new TicketFeedbackService(
    db as unknown as PrismaService,
    access as unknown as TicketAccessPolicyService,
    audit as unknown as AuditLogsService,
    outbox,
    events as unknown as EventEmitter2,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation(
      (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => work(tx),
    );
    db.ticket.findUnique.mockResolvedValue({ ...ticket });
    db.ticket.updateMany.mockResolvedValue({ count: 1 });
    db.ticketFeedback.findUnique.mockResolvedValue(null);
    db.ticketFeedback.create.mockResolvedValue({ score: 5, comment: null });
    db.user.findUnique.mockResolvedValue({ name: 'Người gửi' });
  });
  it('only the creator confirms, even when the caller is ADMIN', async () => {
    await expect(
      service.confirm(5, { resolutionVersion: 2 }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.ticket.updateMany).not.toHaveBeenCalled();
  });
  it('closes a matching resolution without changing the resolution time or SLA', async () => {
    await expect(
      service.confirm(5, { resolutionVersion: 2 }, requester),
    ).resolves.toEqual({ id: 5, status: 'CLOSED' });
    const update = db.ticket.updateMany.mock.calls[0][0];
    expect(update.data).toMatchObject({ status: 'CLOSED' });
    expect(update.data.confirmedAt).toBeInstanceOf(Date);
    expect(Object.keys(update.data).sort()).toEqual(['confirmedAt', 'status']);
    expect(update.data).not.toHaveProperty('resolveAt');
    expect(update.data).not.toHaveProperty('dueAt');
    expect(db.ticketHistory.create.mock.calls[0][0].data).toMatchObject({
      action: 'STATUS_CHANGED',
      oldValue: 'RESOLVED',
      newValue: 'CLOSED',
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'ticket.status_changed' }),
    );
    expect(events.emitAsync).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['IN_PROGRESS', 2],
    ['RESOLVED', 3],
    ['CLOSED', 2],
  ])(
    'rejects a response to status %s / cycle %s without side effects',
    async (status, version) => {
      db.ticket.findUnique.mockResolvedValue({ ...ticket, status });
      await expect(
        service.confirm(5, { resolutionVersion: Number(version) }, requester),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.ticket.updateMany).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    },
  );
  it('detects a concurrent response before history, audit or notifications', async () => {
    db.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.confirm(5, { resolutionVersion: 2 }, requester),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.ticketHistory.create).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
  it('requires a useful reopen reason, keeps assignment/SLA and records the reason in the discussion', async () => {
    await expect(
      service.reopen(5, { resolutionVersion: 2, reason: '  no  ' }, requester),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reopen(
        5,
        { resolutionVersion: 2, reason: '  VPN vẫn lỗi  ' },
        requester,
      ),
    ).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(db.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'IN_PROGRESS', confirmedAt: null, resolveAt: null },
      }),
    );
    expect(db.ticketComment.create).toHaveBeenCalledWith({
      data: {
        ticketId: 5,
        authorId: 3,
        content: 'Yêu cầu xử lý tiếp: VPN vẫn lỗi',
      },
    });
    expect(db.ticketHistory.create).toHaveBeenCalledTimes(2);
  });
  it('propagates outbox failures without invalidating dashboard caches before commit', async () => {
    outbox.enqueue.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(
      service.confirm(5, { resolutionVersion: 2 }, requester),
    ).rejects.toThrow('outbox unavailable');
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
  it.each([0, 6, 1.5])('rejects invalid score %s', async (score) => {
    await expect(service.rate(5, { score }, requester)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([1, 2])('requires a reason for %s stars', async (score) => {
    await expect(
      service.rate(5, { score, comment: '  ' }, requester),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('accepts a single rating only after closing, from the creator, with the assignee snapshot', async () => {
    await expect(service.rate(5, { score: 5 }, requester)).rejects.toThrow(
      'before rating',
    );
    db.ticket.findUnique.mockResolvedValue({ ...ticket, status: 'CLOSED' });
    await expect(service.rate(5, { score: 5 }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await service.rate(
      5,
      { score: 2, comment: '  Phản hồi chưa rõ  ' },
      requester,
    );
    expect(db.ticketFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ticketId: 5,
          authorId: 3,
          assignedToId: 4,
          score: 2,
          comment: 'Phản hồi chưa rõ',
          resolutionVersion: 2,
        },
      }),
    );
    db.ticketFeedback.findUnique.mockResolvedValue({ ticketId: 5 });
    await expect(
      service.rate(5, { score: 5 }, requester),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.ticketFeedback.create).toHaveBeenCalledTimes(1);
  });
  it('maps a duplicate database insert to a conflict and keeps audit failure atomic', async () => {
    db.ticket.findUnique.mockResolvedValue({ ...ticket, status: 'CLOSED' });
    db.ticketFeedback.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.rate(5, { score: 5 }, requester),
    ).rejects.toBeInstanceOf(ConflictException);
    audit.create.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.rate(5, { score: 5 }, requester)).rejects.toThrow(
      'audit unavailable',
    );
  });
  it('uses the existing ticket access check before disclosing feedback', async () => {
    access.canAccessTicket.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.get(5, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.ticketFeedback.findUnique).not.toHaveBeenCalled();
    await service.get(5, requester);
    expect(db.ticketFeedback.findUnique).toHaveBeenCalledWith({
      where: { ticketId: 5 },
      select: { score: true, comment: true, createdAt: true },
    });
  });
});
