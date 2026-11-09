import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async send(
    outboxEventId: string | undefined,
    recipientId: number,
    deliver: () => Promise<{ skipped?: boolean } | void>,
  ): Promise<void> {
    // Direct events have no durable identity; keep their existing behavior.
    if (!outboxEventId) {
      await deliver();
      return;
    }
    const key = { outboxEventId, recipientId };
    const delivered = await this.prisma.emailDelivery.findUnique({
      where: { outboxEventId_recipientId: key },
    });
    if (delivered) return;

    // The outbox owns the event lease/heartbeat. Never hold a DB transaction
    // across SMTP. A completed recipient survives another recipient's retry.
    const result = await deliver();
    if (result?.skipped) return;
    await this.prisma.emailDelivery.upsert({
      where: { outboxEventId_recipientId: key },
      create: key,
      update: {},
    });
    // A crash after SMTP acceptance but before this receipt remains ambiguous:
    // SMTP cannot participate in the database transaction (at-least-once).
  }
}
