import { Logger } from '@nestjs/common';
import { OutboxStatus } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxMetricsCollector } from './outbox-metrics.collector';
import { getReadyOutboxWhere, MAX_ATTEMPTS } from './outbox-policy';

describe('OutboxMetricsCollector', () => {
  const rows = { count: jest.fn(), findFirst: jest.fn() };
  let metrics: MetricsService;
  let collector: OutboxMetricsCollector;
  let errorLog: jest.SpyInstance;
  beforeEach(() => {
    jest.resetAllMocks();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    metrics = new MetricsService();
    collector = new OutboxMetricsCollector(
      { outboxEvent: rows } as unknown as PrismaService,
      metrics,
    );
    rows.count.mockResolvedValue(0);
    rows.findFirst.mockResolvedValue(null);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses current time, shared worker policy and aggregate-only reads', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-09-20T10:00:00Z');
    jest.setSystemTime(now);
    rows.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    rows.findFirst.mockResolvedValue({
      availableAt: new Date(now.getTime() - 90_000),
    });
    await collector.collect();
    expect(rows.count).toHaveBeenNthCalledWith(1, {
      where: getReadyOutboxWhere(now),
    });
    expect(rows.count).toHaveBeenNthCalledWith(2, {
      where: { status: OutboxStatus.FAILED, attempts: { gte: MAX_ATTEMPTS } },
    });
    const output = await metrics.render();
    expect(output).toContain('officeflow_outbox_ready_jobs 3');
    expect(output).toContain('officeflow_outbox_exhausted_jobs 2');
    expect(output).toContain('officeflow_outbox_oldest_ready_age_seconds 90');
    jest.setSystemTime(new Date(now.getTime() + 30_000));
    await collector.collect();
    expect(rows.count).toHaveBeenNthCalledWith(3, {
      where: getReadyOutboxWhere(new Date(now.getTime() + 30_000)),
    });
  });

  it('retains the last snapshot and timestamp after failure instead of reporting zero', async () => {
    rows.count.mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    await collector.collect();
    const before = await metrics.render();
    rows.count.mockRejectedValue(
      new Error('mysql://secret:password@private/db'),
    );
    await expect(collector.collect()).resolves.toBeUndefined();
    const after = await metrics.render();
    expect(after).toContain('officeflow_outbox_ready_jobs 7');
    expect(after).toContain('officeflow_outbox_collection_success 0');
    const timestamp = before
      .split('\n')
      .find((line) =>
        line.startsWith('officeflow_outbox_last_collection_timestamp_seconds '),
      );
    expect(after).toContain(timestamp);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('password@');
    rows.count.mockResolvedValue(0);
    await collector.collect();
    expect(await metrics.render()).toContain(
      'officeflow_outbox_collection_success 1',
    );
  });

  it('coalesces polls, drains pending work at shutdown and never starts again', async () => {
    let release!: (value: number) => void;
    rows.count.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        release = resolve;
      }),
    );
    const first = collector.collect();
    expect(collector.collect()).toBe(first);
    const shutdown = collector.onModuleDestroy();
    expect(rows.count).toHaveBeenCalledTimes(2);
    release(0);
    await Promise.all([first, shutdown]);
    await collector.collect();
    expect(rows.count).toHaveBeenCalledTimes(2);
  });

  it('does not throw when the optional metrics recorder fails', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(metrics, 'recordOutboxSnapshot').mockImplementation(() => {
      throw new Error('test');
    });
    await expect(collector.collect()).resolves.toBeUndefined();
  });
});
