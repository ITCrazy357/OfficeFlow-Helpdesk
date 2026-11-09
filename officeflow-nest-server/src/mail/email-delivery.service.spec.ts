import { EmailDeliveryService } from './email-delivery.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmailDeliveryService durable receipts', () => {
  const rows = new Set<string>();
  const model = { findUnique: jest.fn(), upsert: jest.fn() };
  const prisma = { emailDelivery: model } as unknown as PrismaService;
  let service: EmailDeliveryService;
  beforeEach(() => {
    rows.clear();
    jest.resetAllMocks();
    model.findUnique.mockImplementation(
      ({
        where,
      }: {
        where: {
          outboxEventId_recipientId: {
            outboxEventId: string;
            recipientId: number;
          };
        };
      }) =>
        Promise.resolve(
          rows.has(JSON.stringify(where.outboxEventId_recipientId)) ? {} : null,
        ),
    );
    model.upsert.mockImplementation(
      ({
        create,
      }: {
        create: { outboxEventId: string; recipientId: number };
      }) => {
        rows.add(JSON.stringify(create));
        return Promise.resolve({});
      },
    );
    service = new EmailDeliveryService(prisma);
  });

  it('a new worker skips successful recipients and retries only failed recipients', async () => {
    const first = jest.fn().mockResolvedValue({ skipped: false });
    const second = jest
      .fn()
      .mockRejectedValueOnce(new Error('SMTP fixture failure'))
      .mockResolvedValue({ skipped: false });
    await service.send('event-1', 1, first);
    await expect(service.send('event-1', 2, second)).rejects.toThrow(
      'SMTP fixture',
    );
    service = new EmailDeliveryService(prisma);
    await service.send('event-1', 1, first);
    await service.send('event-1', 2, second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(rows.size).toBe(2);
    await service.send('event-2', 1, first);
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('propagates a receipt lookup outage before attempting SMTP', async () => {
    model.findUnique.mockRejectedValueOnce(new Error('receipt read outage'));
    const send = jest.fn();
    await expect(service.send('event-1', 1, send)).rejects.toThrow(
      'receipt read outage',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('does not acknowledge a receipt write failure after SMTP acceptance', async () => {
    model.upsert.mockRejectedValueOnce(new Error('receipt write outage'));
    const send = jest.fn().mockResolvedValue({ skipped: false });
    await expect(service.send('event-1', 1, send)).rejects.toThrow(
      'receipt write outage',
    );
    expect(rows.size).toBe(0);
  });

  it('does not persist skipped delivery and preserves direct events without an identity', async () => {
    const send = jest.fn().mockResolvedValue({ skipped: true });
    await service.send('event-1', 1, send);
    expect(model.upsert).not.toHaveBeenCalled();
    model.findUnique.mockClear();
    await service.send(undefined, 1, send);
    expect(model.findUnique).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
