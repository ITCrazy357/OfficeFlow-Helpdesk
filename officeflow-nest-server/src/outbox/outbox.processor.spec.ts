import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OutboxProcessor } from './outbox.processor';

// Jest matchers return any; keep nested expected values explicitly unknown.
function objectContaining(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value);
}

const mockOutboxEvent = {
  findMany: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
};

const mockPrisma = {
  outboxEvent: mockOutboxEvent,
};

const mockEventEmitter = {
  emitAsync: jest.fn(),
};

const candidate = {
  id: 'f93fc842-2cf2-4f4b-8791-824457674900',
  type: 'ticket.created',
  payload: { ticketId: 42 },
  attempts: 0,
};

describe('OutboxProcessor', () => {
  let processor: OutboxProcessor;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockOutboxEvent.findMany.mockResolvedValue([candidate]);
    mockOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockOutboxEvent.deleteMany.mockResolvedValue({ count: 0 });
    mockEventEmitter.emitAsync.mockResolvedValue([undefined]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    processor = module.get(OutboxProcessor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renews the lease while a slow handler is running and stops after completion', async () => {
    jest.useFakeTimers();
    let finish!: (value: unknown[]) => void;
    mockEventEmitter.emitAsync.mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          finish = resolve;
        }),
    );
    const processing = processor.processBatch();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockOutboxEvent.updateMany).toHaveBeenLastCalledWith({
      where: objectContaining({
        id: candidate.id,
        attempts: 1,
        status: OutboxStatus.PROCESSING,
      }),
      data: { lockedAt: expect.any(Date) as Date },
    });
    finish([undefined]);
    await processing;
    const calls = mockOutboxEvent.updateMany.mock.calls.length;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockOutboxEvent.updateMany).toHaveBeenCalledTimes(calls);
  });

  it('uses a fresh lease timestamp for each event rather than the batch start time', async () => {
    jest.useFakeTimers();
    const startedAt = new Date('2026-09-07T00:00:00Z');
    jest.setSystemTime(startedAt);
    mockOutboxEvent.findMany.mockResolvedValue([
      candidate,
      { ...candidate, id: 'second' },
    ]);
    mockEventEmitter.emitAsync.mockImplementationOnce(() => {
      jest.setSystemTime(new Date(startedAt.getTime() + 180_000));
      return Promise.resolve([undefined]);
    });
    await processor.processBatch();
    expect(mockOutboxEvent.updateMany).toHaveBeenNthCalledWith(
      3,
      objectContaining({
        where: objectContaining({
          id: 'second',
          attempts: { equals: 0, lt: 8 },
        }),
        data: objectContaining({
          lockedAt: new Date(startedAt.getTime() + 180_000),
        }),
      }),
    );
  });

  it('moves abandoned final attempts to FAILED for manual review', async () => {
    mockOutboxEvent.findMany.mockResolvedValue([]);
    await processor.poll();
    expect(mockOutboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        status: OutboxStatus.PROCESSING,
        attempts: { gte: 8 },
        lockedAt: { lt: expect.any(Date) as Date },
      },
      data: objectContaining({
        status: OutboxStatus.FAILED,
        lockedAt: null,
        lockedBy: null,
      }),
    });
  });

  it('does not automatically retry exhausted events and only purges processed events', async () => {
    mockOutboxEvent.findMany.mockResolvedValue([]);
    await processor.processBatch();
    expect(mockOutboxEvent.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          attempts: { lt: 8 },
          availableAt: { lte: expect.any(Date) as Date },
        }),
      }),
    );
    await processor.removeExpiredEvents();
    expect(mockOutboxEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        status: OutboxStatus.PROCESSED,
        processedAt: { lt: expect.any(Date) as Date },
      },
    });
  });

  it('claims, dispatches, and marks an event as processed', async () => {
    await expect(processor.processBatch()).resolves.toBe(1);

    expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(candidate.type, {
      ticketId: 42,
      outboxEventId: candidate.id,
    });
    expect(mockOutboxEvent.updateMany).toHaveBeenNthCalledWith(
      2,
      objectContaining({
        where: objectContaining({
          id: candidate.id,
          status: OutboxStatus.PROCESSING,
        }),
        data: objectContaining({
          status: OutboxStatus.PROCESSED,
          processedAt: expect.any(Date) as Date,
          lockedAt: null,
          lockedBy: null,
        }),
      }),
    );
  });

  it('does not dispatch an event claimed by another worker', async () => {
    mockOutboxEvent.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(processor.processBatch()).resolves.toBe(0);

    expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('records a retry with backoff when a listener fails', async () => {
    mockEventEmitter.emitAsync.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(processor.processBatch()).resolves.toBe(1);

    expect(mockOutboxEvent.updateMany).toHaveBeenNthCalledWith(
      2,
      objectContaining({
        data: objectContaining({
          status: OutboxStatus.FAILED,
          availableAt: expect.any(Date) as Date,
          lastError: 'SMTP unavailable',
          lockedAt: null,
          lockedBy: null,
        }),
      }),
    );
  });

  it('treats an event without a registered handler as retryable failure', async () => {
    mockEventEmitter.emitAsync.mockResolvedValue([]);

    await expect(processor.processBatch()).resolves.toBe(1);

    expect(mockOutboxEvent.updateMany).toHaveBeenNthCalledWith(
      2,
      objectContaining({
        data: objectContaining({
          status: OutboxStatus.FAILED,
          lastError: 'No handler registered for outbox event ticket.created',
        }),
      }),
    );
  });
});
