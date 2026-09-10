import { Prisma } from '@prisma/client';

type SchemaClient = Pick<
  Prisma.TransactionClient,
  'outboxEvent' | 'notification'
>;

export async function assertOutboxSchemaReady(
  database: SchemaClient,
): Promise<void> {
  try {
    // Even an empty table must resolve these columns. No writes or migration here.
    await database.outboxEvent.findFirst({
      select: {
        id: true,
        type: true,
        payload: true,
        status: true,
        attempts: true,
        availableAt: true,
        lockedAt: true,
        lockedBy: true,
        processedAt: true,
        lastError: true,
        deduplicationKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await database.notification.findFirst({ select: { sourceEventId: true } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      throw new Error(
        `Database schema is not ready (${error.code}). Check migration 20260906170000_add_transactional_outbox and the database target. Back up and review pending migrations before deploying them.`,
      );
    }
    throw error;
  }
}
