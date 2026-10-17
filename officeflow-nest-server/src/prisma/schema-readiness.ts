import { Prisma } from '@prisma/client';

type SchemaClient = Pick<
  Prisma.TransactionClient,
  'outboxEvent' | 'notification' | 'ticket' | 'slaPolicy' | 'slaAlert'
>;

export async function assertDatabaseSchemaReady(
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
    await database.ticket.findFirst({
      select: {
        slaPolicy: true,
        firstResponseDueAt: true,
        firstRespondedAt: true,
        firstResponseOverdue: true,
        responseWarningAt: true,
        resolutionWarningAt: true,
      },
    });
    await database.slaPolicy.findFirst({
      select: { id: true, config: true, version: true, updatedAt: true },
    });
    await database.slaAlert.findFirst({
      select: {
        id: true,
        ticketId: true,
        milestone: true,
        kind: true,
        managerId: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      // Retain the error code for safe startup diagnostics, without raw SQL,
      // connection details or adapter metadata from the original error.
      throw new Prisma.PrismaClientKnownRequestError(
        `Database schema is not ready (${error.code}). Check migrations 20260906170000_add_transactional_outbox and 20261017120000_add_business_sla and the database target. Back up and review pending migrations before deploying them.`,
        { code: error.code, clientVersion: error.clientVersion },
      );
    }
    throw error;
  }
}
