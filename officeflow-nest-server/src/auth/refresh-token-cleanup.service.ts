import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

export const REFRESH_TOKEN_CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_CLEANUP_BATCH_SIZE = 1_000;
const REFRESH_TOKEN_CLEANUP_MAX_BATCHES = 100;

@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);
  private cleanupInProgress = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'refresh-token-cleanup',
    timeZone: 'UTC',
  })
  async cleanupExpiredRefreshTokens(): Promise<number> {
    if (this.cleanupInProgress) {
      this.logger.warn(
        'Skipped refresh token cleanup because it is still running',
      );
      return 0;
    }

    this.cleanupInProgress = true;

    try {
      const cutoff = new Date(Date.now() - REFRESH_TOKEN_CLEANUP_RETENTION_MS);
      let totalDeleted = 0;

      for (
        let batch = 0;
        batch < REFRESH_TOKEN_CLEANUP_MAX_BATCHES;
        batch += 1
      ) {
        const expiredTokens = await this.prisma.refreshToken.findMany({
          where: {
            expiresAt: {
              lt: cutoff,
            },
          },
          select: {
            id: true,
          },
          orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
          take: REFRESH_TOKEN_CLEANUP_BATCH_SIZE,
        });

        if (expiredTokens.length === 0) {
          break;
        }

        const deleted = await this.prisma.refreshToken.deleteMany({
          where: {
            id: {
              in: expiredTokens.map((token) => token.id),
            },
            expiresAt: {
              lt: cutoff,
            },
          },
        });

        totalDeleted += deleted.count;

        if (
          expiredTokens.length < REFRESH_TOKEN_CLEANUP_BATCH_SIZE ||
          deleted.count === 0
        ) {
          break;
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(`Deleted ${totalDeleted} expired refresh tokens`);
      }

      return totalDeleted;
    } finally {
      this.cleanupInProgress = false;
    }
  }
}
