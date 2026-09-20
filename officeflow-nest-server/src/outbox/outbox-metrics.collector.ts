import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { Injectable, Logger } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';

const MaX_ATTEMPTS = 5;
const now = new Date();
const staleBefore = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

@Injectable()
export class OutboxMetricsCollector {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {
    const readyWhere: Prisma.OutboxEventWhereInput = {
      attempts: { lt: MaX_ATTEMPTS },
      availableAt: { lte: now },
      OR: [
        {
          status: {
            in: [OutboxStatus.PENDING, OutboxStatus.FAILED],
          },
        },
        {
          status: OutboxStatus.PROCESSING,
          lockedAt: { lt: staleBefore },
        },
      ],
    };
  }
}
