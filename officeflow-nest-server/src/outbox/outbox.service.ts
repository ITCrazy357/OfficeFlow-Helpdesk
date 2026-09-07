import { Injectable } from '@nestjs/common';
import { Prisma, type OutboxEvent } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import type {
  OutboxEventPayloadByType,
  OutboxEventType,
} from './outbox.constants';

type OutboxClient = Pick<Prisma.TransactionClient, 'outboxEvent'>;

const SENSITIVE_PAYLOAD_KEY =
  /^(?:password|passwordHash|rawToken|accessToken|refreshToken|apiSecret)$/i;

function assertPayloadDoesNotContainSecrets(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_PAYLOAD_KEY.test(key)) {
      throw new Error(`Sensitive field "${key}" cannot be stored in outbox`);
    }

    assertPayloadDoesNotContainSecrets(child);
  }
}

@Injectable()
export class OutboxService {
  enqueue<T extends OutboxEventType>(
    client: OutboxClient,
    params: {
      type: T;
      payload: OutboxEventPayloadByType[T] & Prisma.InputJsonObject;
      deduplicationKey?: string;
      availableAt?: Date;
    },
  ): Promise<Pick<OutboxEvent, 'id'>> {
    assertPayloadDoesNotContainSecrets(params.payload);

    return client.outboxEvent.create({
      data: {
        type: params.type,
        payload: params.payload,
        deduplicationKey: params.deduplicationKey ?? randomUUID(),
        availableAt: params.availableAt,
      },
      select: {
        id: true,
      },
    });
  }
}
