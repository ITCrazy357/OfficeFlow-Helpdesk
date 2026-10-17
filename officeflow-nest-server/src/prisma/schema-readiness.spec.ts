import { Prisma } from '@prisma/client';
import { assertDatabaseSchemaReady } from './schema-readiness';
import { getSafeErrorDetails } from '../common/diagnostics/request-diagnostics';

describe('Database schema readiness', () => {
  const database = {
    outboxEvent: { findFirst: jest.fn() },
    notification: { findFirst: jest.fn() },
    ticket: { findFirst: jest.fn() },
    slaPolicy: { findFirst: jest.fn() },
    slaAlert: { findFirst: jest.fn() },
  };
  const client = database as unknown as Parameters<
    typeof assertDatabaseSchemaReady
  >[0];
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('accepts empty tables without creating data', async () => {
    database.outboxEvent.findFirst.mockResolvedValue(null);
    database.notification.findFirst.mockResolvedValue(null);
    await expect(assertDatabaseSchemaReady(client)).resolves.toBeUndefined();
    expect(database.notification.findFirst).toHaveBeenCalledWith({
      select: { sourceEventId: true },
    });
    expect(database.ticket.findFirst).toHaveBeenCalledWith({
      select: {
        slaPolicy: true,
        firstResponseDueAt: true,
        firstRespondedAt: true,
        firstResponseOverdue: true,
        responseWarningAt: true,
        resolutionWarningAt: true,
      },
    });
    expect(database.slaPolicy.findFirst).toHaveBeenCalledTimes(1);
    expect(database.slaAlert.findFirst).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['outboxEvent', 'P2021'],
    ['notification', 'P2022'],
    ['ticket', 'P2022'],
    ['slaPolicy', 'P2021'],
    ['slaAlert', 'P2021'],
  ] as const)(
    'explains missing schema for %s without leaking DB details',
    async (model, code) => {
      database[model].findFirst.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('secret-database-url', {
          code,
          clientVersion: 'test',
        }),
      );
      await expect(assertDatabaseSchemaReady(client)).rejects.toThrow(
        `Database schema is not ready (${code})`,
      );
      await expect(assertDatabaseSchemaReady(client)).rejects.not.toThrow(
        'secret-database-url',
      );
      const error = await assertDatabaseSchemaReady(client).catch(
        (failure: unknown) => failure,
      );
      expect(getSafeErrorDetails(error)).toMatchObject({
        code,
        hint:
          code === 'P2021'
            ? 'missing_database_table_check_migrations'
            : 'missing_database_column_check_migrations',
      });
    },
  );

  it('does not mislabel a connection failure as a missing migration', async () => {
    const error = new Error('Connection timeout');
    database.outboxEvent.findFirst.mockRejectedValue(error);
    await expect(assertDatabaseSchemaReady(client)).rejects.toBe(error);
  });
});
