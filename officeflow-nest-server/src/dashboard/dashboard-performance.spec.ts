import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { DEFAULT_SLA_POLICY } from '../sla/sla-policy';
import {
  getPerformanceRange,
  loadPerformanceReport,
} from './dashboard-performance';

describe('Processing performance report', () => {
  const now = new Date('2026-10-20T18:00:00+07:00');
  const range = () =>
    getPerformanceRange({ from: '2026-10-16', to: '2026-10-20' }, now);
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });
  afterEach(() => jest.useRealTimers());

  it('defaults to 30 inclusive Vietnam dates and keeps the end exclusive', () => {
    const dates = getPerformanceRange({}, new Date('2026-10-18T17:00:00Z'));
    expect(dates.from).toBe('2026-09-20');
    expect(dates.to).toBe('2026-10-19');
    expect(dates.start).toEqual(new Date('2026-09-19T17:00:00Z'));
    expect(dates.end).toEqual(new Date('2026-10-19T17:00:00Z'));
    expect(
      getPerformanceRange({ from: '2025-10-20', to: '2026-10-20' }, now),
    ).toBeDefined();
  });

  it.each([
    { from: '2026-02-30', to: '2026-10-20' },
    { from: '2026-10-20', to: '2026-10-19' },
    { from: '2026-10-01', to: '2026-10-21' },
    { from: '2025-10-19', to: '2026-10-20' },
    { from: '2026-1-01', to: '2026-10-20' },
    { from: 'garbage', to: '2026-10-20' },
  ])('rejects invalid, reversed, future or excessive ranges: %p', (query) => {
    expect(() => getPerformanceRange(query, now)).toThrow();
  });

  function database(tickets: unknown[] = [], transitions: unknown[] = []) {
    type TicketQuery = {
      where: { AND: [Prisma.TicketWhereInput, { id: { gt: number } }] };
      take: number;
    };
    type CountQuery = {
      where: {
        AND: [Prisma.TicketWhereInput, { createdAt: { gt?: Date; lte: Date } }];
      };
    };
    const tx = {
      ticket: {
        findMany: jest
          .fn<Promise<unknown[]>, [TicketQuery]>()
          .mockResolvedValue(tickets),
        count: jest.fn<Promise<number>, [CountQuery]>().mockResolvedValue(0),
      },
      ticketHistory: { groupBy: jest.fn().mockResolvedValue(transitions) },
    };
    const transaction = jest.fn(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );
    return {
      tx,
      transaction,
      prisma: { $transaction: transaction } as unknown as PrismaService,
    };
  }

  it('returns null for no samples and preserves empty dates and all backlog buckets', async () => {
    const { tx, prisma, transaction } = database();
    const report = await loadPerformanceReport(
      prisma,
      { createdById: 42 },
      range(),
    );
    expect(report.cohort).toMatchObject({
      total: 0,
      reopenRate: null,
      firstResponse: { minutes: null, samples: 0 },
      resolution: { minutes: null, samples: 0 },
    });
    expect(report.daily).toHaveLength(5);
    expect(
      report.daily.every((day) => day.created === 0 && day.completed === 0),
    ).toBe(true);
    expect(report.backlog).toHaveLength(5);
    expect(tx.ticketHistory.groupBy).not.toHaveBeenCalled();
    expect(tx.ticket.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      createdById: 42,
    });
    expect(tx.ticket.count).toHaveBeenCalledTimes(5);
    for (const [query] of tx.ticket.count.mock.calls)
      expect(query.where.AND[0]).toEqual({ createdById: 42 });
    const bounds = tx.ticket.count.mock.calls.map(
      ([query]) => query.where.AND[1].createdAt,
    );
    expect(bounds[0].lte).toEqual(now);
    expect(bounds[0].gt).toEqual(bounds[1].lte);
    expect(bounds[3].gt).toEqual(bounds[4].lte);
    expect(bounds[4].gt).toBeUndefined();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      timeout: 30000,
    });
  });

  const ticket = (id: number, overrides = {}) => ({
    id,
    createdAt: new Date('2026-10-16T11:00:00+07:00'),
    status: 'RESOLVED',
    firstRespondedAt: null,
    resolveAt: null,
    slaPolicy: DEFAULT_SLA_POLICY,
    ...overrides,
  });

  it('uses each saved calendar, counts genuine zeroes, excludes missing/invalid timestamps and deduplicates reopening', async () => {
    const { prisma } = database(
      [
        ticket(1, {
          firstRespondedAt: new Date('2026-10-16T14:00:00+07:00'),
          resolveAt: new Date('2026-10-19T10:00:00+07:00'),
        }),
        ticket(2, {
          status: 'CLOSED',
          slaPolicy: null,
          firstRespondedAt: new Date('2026-10-16T11:00:00+07:00'),
          resolveAt: new Date('2026-10-19T10:00:00+07:00'),
        }),
        ticket(3, {
          status: 'IN_PROGRESS',
          firstRespondedAt: new Date('2026-10-15T11:00:00+07:00'),
        }),
        ticket(4, {
          status: 'CANCELLED',
          firstRespondedAt: new Date('2026-10-21T11:00:00+07:00'),
        }),
      ],
      [
        { ticketId: 3, oldValue: 'RESOLVED', newValue: 'IN_PROGRESS' },
        { ticketId: 3, oldValue: 'RESOLVED', newValue: 'OPEN' },
        { ticketId: 3, oldValue: 'IN_PROGRESS', newValue: 'RESOLVED' },
      ],
    );
    const report = await loadPerformanceReport(prisma, {}, range());
    expect(report.cohort).toEqual({
      total: 4,
      completed: 2,
      everCompleted: 3,
      reopened: 1,
      reopenRate: 33.33,
      legacyCalendarTickets: 1,
      firstResponse: { minutes: 60, samples: 2 },
      resolution: { minutes: 2340, samples: 2 },
    });
    expect(report.daily[0]).toEqual({
      date: '2026-10-16',
      created: 4,
      completed: 2,
    });
  });

  it('keeps per-ticket holiday snapshots rather than applying the current policy', async () => {
    const { prisma } = database([
      ticket(1, {
        slaPolicy: { ...DEFAULT_SLA_POLICY, holidays: ['2026-10-16'] },
        resolveAt: new Date('2026-10-16T14:00:00+07:00'),
      }),
    ]);
    const report = await loadPerformanceReport(prisma, {}, range());
    expect(report.cohort.resolution).toEqual({ minutes: 0, samples: 1 });
  });

  it('scans bounded pages with an increasing cursor, without truncating at 500 tickets', async () => {
    const { tx, prisma } = database();
    tx.ticket.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, id) => ticket(id + 1)),
      )
      .mockResolvedValueOnce([ticket(501)]);
    const report = await loadPerformanceReport(prisma, {}, range());
    expect(report.cohort.total).toBe(501);
    expect(tx.ticket.findMany).toHaveBeenCalledTimes(2);
    expect(tx.ticket.findMany.mock.calls[1][0]).toMatchObject({
      take: 500,
      where: { AND: [{}, { id: { gt: 500 } }] },
    });
    expect(tx.ticketHistory.groupBy).toHaveBeenCalledTimes(2);
  });
});
