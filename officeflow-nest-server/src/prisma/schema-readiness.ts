import { Prisma } from '@prisma/client';

type SchemaClient = Pick<
  Prisma.TransactionClient,
  | 'outboxEvent'
  | 'emailDelivery'
  | 'notification'
  | 'ticket'
  | 'slaPolicy'
  | 'slaAlert'
  | 'asset'
  | 'assetMaintenance'
  | 'assetWarrantyReminder'
  | 'leaveRequest'
  | 'leaveDay'
  | 'leaveEntitlement'
  | 'ticketFeedback'
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
    await database.emailDelivery.findFirst({
      select: { outboxEventId: true, recipientId: true, deliveredAt: true },
    });
    await database.ticket.findFirst({
      select: {
        slaPolicy: true,
        firstResponseDueAt: true,
        firstRespondedAt: true,
        firstResponseOverdue: true,
        responseWarningAt: true,
        resolutionWarningAt: true,
        resolutionVersion: true,
        confirmedAt: true,
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
    await database.asset.findFirst({
      select: { supplierName: true, supplierContact: true },
    });
    await database.assetMaintenance.findFirst({
      select: {
        id: true,
        assetId: true,
        scheduledFor: true,
        performedOn: true,
        cost: true,
        version: true,
      },
    });
    await database.assetWarrantyReminder.findFirst({
      select: { assetId: true, warrantyDate: true },
    });
    await database.leaveRequest.findFirst({
      select: { type: true, period: true, calendarSnapshot: true },
    });
    await database.leaveDay.findFirst({
      select: { requestId: true, date: true, halfDays: true },
    });
    await database.leaveEntitlement.findFirst({
      select: { userId: true, year: true, halfDays: true, version: true },
    });
    await database.ticketFeedback.findFirst({
      select: {
        ticketId: true,
        score: true,
        comment: true,
        resolutionVersion: true,
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
        `Database schema is not ready (${error.code}). Check migrations 20260906170000_add_transactional_outbox, 20261017120000_add_business_sla, 20261018120000_add_asset_care, 20261018160000_add_leave_planning_and_ticket_feedback, 20261101010000_add_email_delivery_receipts and the database target. Back up and review pending migrations before deploying them.`,
        { code: error.code, clientVersion: error.clientVersion },
      );
    }
    throw error;
  }
}
