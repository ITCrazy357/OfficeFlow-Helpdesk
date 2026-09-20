import { OutboxStatus, type Prisma } from '@prisma/client';

export const MAX_ATTEMPTS = 8;
export const LOCK_TIMEOUT_IN_MS = 2 * 60_000;

export function getReadyOutboxWhere(now: Date): Prisma.OutboxEventWhereInput {
  return {
    attempts: { lt: MAX_ATTEMPTS },
    availableAt: { lte: now },
    OR: [
      { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
      {
        status: OutboxStatus.PROCESSING,
        lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_IN_MS) },
      },
    ],
  };
}
