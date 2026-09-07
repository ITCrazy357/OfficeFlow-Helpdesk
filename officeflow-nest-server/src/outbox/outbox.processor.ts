import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, Interval } from '@nestjs/schedule';
import { OutboxStatus, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

const POLL_INTERVAL_IN_MS = 5_000;
const LOCK_TIMEOUT_IN_MS = 2 * 60_000;
const HEARTBEAT_INTERVAL_IN_MS = 30_000;
const RETENTION_IN_MS = 30 * 24 * 60 * 60_000;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 8;
const BASE_RETRY_DELAY_IN_MS = 5_000;
const MAX_RETRY_DELAY_IN_MS = 5 * 60_000;
const MAX_ERROR_LENGTH = 2_000;

type ClaimedOutboxEvent = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

function isPayloadObject(
  payload: Prisma.JsonValue,
): payload is Prisma.JsonObject {
  return (
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
  );
}

function getErrorMessage(error: unknown): string {
  return (
    error instanceof Error ? error.message : 'Unknown outbox error'
  ).slice(0, MAX_ERROR_LENGTH);
}

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly workerId = `officeflow-${process.pid}-${randomUUID()}`;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Interval(POLL_INTERVAL_IN_MS)
  async poll(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // A crash on the last attempt must not leave a job PROCESSING forever.
      await this.prisma.outboxEvent.updateMany({
        where: {
          status: OutboxStatus.PROCESSING,
          attempts: { gte: MAX_ATTEMPTS },
          lockedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_IN_MS) },
        },
        data: {
          status: OutboxStatus.FAILED,
          lockedAt: null,
          lockedBy: null,
          lastError:
            'Worker lease expired after the final attempt; manual review required',
        },
      });
      await this.processBatch();
    } catch (error: unknown) {
      this.logger.error(`Outbox polling failed: ${getErrorMessage(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async processBatch(): Promise<number> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_IN_MS);
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        attempts: { lt: MAX_ATTEMPTS },
        availableAt: { lte: now },
        OR: [
          { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
          {
            status: OutboxStatus.PROCESSING,
            lockedAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      take: BATCH_SIZE,
      select: {
        id: true,
        type: true,
        payload: true,
        attempts: true,
      },
    });

    let attemptedCount = 0;

    for (const candidate of candidates) {
      const claimedAt = new Date();
      const claimed = await this.claim(
        candidate,
        claimedAt,
        new Date(claimedAt.getTime() - LOCK_TIMEOUT_IN_MS),
      );

      if (!claimed) {
        continue;
      }

      await this.processEvent(candidate);
      attemptedCount += 1;
    }

    return attemptedCount;
  }

  @Cron('0 3 * * *')
  async removeExpiredEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_IN_MS);
    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        status: OutboxStatus.PROCESSED,
        processedAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Removed ${result.count} expired outbox events`);
    }
  }

  private async claim(
    event: ClaimedOutboxEvent,
    now: Date,
    staleBefore: Date,
  ): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        // Fence stale candidates if another worker has already attempted them.
        attempts: { equals: event.attempts, lt: MAX_ATTEMPTS },
        availableAt: { lte: now },
        OR: [
          { status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] } },
          {
            status: OutboxStatus.PROCESSING,
            lockedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy: this.workerId,
        lastError: null,
      },
    });

    return result.count === 1;
  }

  private async processEvent(event: ClaimedOutboxEvent): Promise<void> {
    const ownership = {
      id: event.id,
      status: OutboxStatus.PROCESSING,
      lockedBy: this.workerId,
      attempts: event.attempts + 1,
    };
    let heartbeatPending: Promise<void> | undefined;
    const heartbeat = setInterval(() => {
      if (heartbeatPending) return;
      heartbeatPending = this.prisma.outboxEvent
        .updateMany({ where: ownership, data: { lockedAt: new Date() } })
        .then(() => undefined)
        .catch((error: unknown) => {
          this.logger.error(
            `Outbox heartbeat failed for ${event.id}: ${getErrorMessage(error)}`,
          );
        })
        .finally(() => {
          heartbeatPending = undefined;
        });
    }, HEARTBEAT_INTERVAL_IN_MS);
    heartbeat.unref();

    try {
      if (!isPayloadObject(event.payload)) {
        throw new Error('Outbox payload must be a JSON object');
      }

      const results = await this.eventEmitter.emitAsync(event.type, {
        ...event.payload,
        outboxEventId: event.id,
      });

      if (results.length === 0) {
        throw new Error(`No handler registered for outbox event ${event.type}`);
      }

      await this.prisma.outboxEvent.updateMany({
        where: ownership,
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });
    } catch (error: unknown) {
      const attempt = event.attempts + 1;
      const delay = Math.min(
        BASE_RETRY_DELAY_IN_MS * 2 ** Math.max(0, attempt - 1),
        MAX_RETRY_DELAY_IN_MS,
      );
      const message = getErrorMessage(error);

      await this.prisma.outboxEvent.updateMany({
        where: ownership,
        data: {
          status: OutboxStatus.FAILED,
          availableAt: new Date(Date.now() + delay),
          lockedAt: null,
          lockedBy: null,
          lastError: message,
        },
      });

      this.logger.error(
        `Outbox event ${event.id} (${event.type}) failed on attempt ${attempt}/${MAX_ATTEMPTS}: ${message}`,
      );
    } finally {
      clearInterval(heartbeat);
      await heartbeatPending;
    }
  }
}
