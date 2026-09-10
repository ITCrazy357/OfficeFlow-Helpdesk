import { Prisma } from '@prisma/client';
import { assertOutboxSchemaReady } from './schema-readiness';

describe('Outbox schema readiness', () => {
  const database = {
    outboxEvent: { findFirst: jest.fn() },
    notification: { findFirst: jest.fn() },
  };
  const client = database as unknown as Parameters<
    typeof assertOutboxSchemaReady
  >[0];
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('accepts empty tables without creating data', async () => {
    database.outboxEvent.findFirst.mockResolvedValue(null);
    database.notification.findFirst.mockResolvedValue(null);
    await expect(assertOutboxSchemaReady(client)).resolves.toBeUndefined();
    expect(database.notification.findFirst).toHaveBeenCalledWith({
      select: { sourceEventId: true },
    });
  });

  it.each([
    ['outboxEvent', 'P2021'],
    ['notification', 'P2022'],
  ] as const)(
    'explains missing schema for %s without leaking DB details',
    async (model, code) => {
      database[model].findFirst.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('secret-database-url', {
          code,
          clientVersion: 'test',
        }),
      );
      await expect(assertOutboxSchemaReady(client)).rejects.toThrow(
        `Database schema is not ready (${code})`,
      );
      await expect(assertOutboxSchemaReady(client)).rejects.not.toThrow(
        'secret-database-url',
      );
    },
  );

  it('does not mislabel a connection failure as a missing migration', async () => {
    const error = new Error('Connection timeout');
    database.outboxEvent.findFirst.mockRejectedValue(error);
    await expect(assertOutboxSchemaReady(client)).rejects.toBe(error);
  });
});
