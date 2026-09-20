import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { observeSafely } from '../common/diagnostics/safe-observation';
import { getSafeErrorDetails } from '../common/diagnostics/request-diagnostics';
import { getReadyOutboxWhere, MAX_ATTEMPTS } from './outbox-policy';

@Injectable()
export class OutboxMetricsCollector implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxMetricsCollector.name);
  private pending?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Interval(30_000)
  collect(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.refresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async refresh(): Promise<void> {
    const sampledAt = new Date();
    const where = getReadyOutboxWhere(sampledAt);
    try {
      const [ready, exhausted, oldest] = await Promise.all([
        this.prisma.outboxEvent.count({ where }),
        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.FAILED,
            attempts: { gte: MAX_ATTEMPTS },
          },
        }),
        this.prisma.outboxEvent.findFirst({
          where,
          orderBy: { availableAt: 'asc' },
          select: { availableAt: true },
        }),
      ]);
      observeSafely(() =>
        this.metrics.recordOutboxSnapshot({
          ready,
          exhausted,
          sampledAt,
          oldestAgeSeconds: oldest
            ? Math.max(
                0,
                (sampledAt.getTime() - oldest.availableAt.getTime()) / 1000,
              )
            : 0,
        }),
      );
    } catch (error) {
      observeSafely(() => this.metrics.recordOutboxCollectionFailure());
      this.logger.error({
        event: 'outbox_metrics_collection_failed',
        ...getSafeErrorDetails(error),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.pending;
  }
}
