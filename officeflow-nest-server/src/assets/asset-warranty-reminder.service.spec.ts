import type { PrismaService } from '../prisma/prisma.service';
import type { OutboxService } from '../outbox/outbox.service';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  AssetWarrantyNotificationListener,
  AssetWarrantyReminderService,
} from './asset-warranty-reminder.service';

describe('Warranty reminders', () => {
  const asset = {
    id: 2,
    assetTag: 'LAP-2',
    name: 'Laptop',
    status: 'ASSIGNED',
    warrantyUntil: new Date('2026-10-22'),
  };
  const tx = {
    asset: { findFirst: jest.fn() },
    assetWarrantyReminder: { findUnique: jest.fn(), create: jest.fn() },
    user: { findMany: jest.fn() },
  };
  const prisma = {
    asset: { findMany: jest.fn(), findUnique: jest.fn() },
    assetWarrantyReminder: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const outbox = { enqueue: jest.fn() };
  const notifications = { createdMany: jest.fn() };
  let service: AssetWarrantyReminderService;
  const event = {
    assetId: 2,
    assetTag: 'LAP-2',
    assetName: 'Laptop',
    warrantyDate: '2026-10-22',
    recipientIds: [1, 3],
    outboxEventId: 'event-1',
  };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-18T17:00:00Z'));
    jest.resetAllMocks();
    service = new AssetWarrantyReminderService(
      prisma as unknown as PrismaService,
      outbox as OutboxService,
    );
    prisma.$transaction.mockImplementation(
      (work: (database: typeof tx) => Promise<unknown>) => work(tx),
    );
    prisma.asset.findMany.mockResolvedValue([asset]);
    prisma.assetWarrantyReminder.findMany.mockResolvedValue([]);
    tx.asset.findFirst.mockResolvedValue(asset);
    tx.assetWarrantyReminder.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([{ id: 1 }, { id: 3 }]);
    prisma.asset.findUnique.mockResolvedValue(asset);
    prisma.user.findMany.mockResolvedValue([{ id: 1 }]);
  });
  afterEach(() => jest.useRealTimers());
  it('claims a durable marker and outbox event in one serializable transaction', async () => {
    await service.notifyExpiringWarranties();
    expect(tx.assetWarrantyReminder.create).toHaveBeenCalledWith({
      data: { assetId: 2, warrantyDate: new Date('2026-10-22') },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(tx, {
      type: 'asset.warranty_expiring',
      deduplicationKey: 'asset-warranty:2:2026-10-22',
      payload: {
        assetId: 2,
        assetTag: 'LAP-2',
        assetName: 'Laptop',
        warrantyDate: '2026-10-22',
        recipientIds: [1, 3],
      },
    });
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: {
        role: { in: ['ADMIN', 'IT_STAFF'] },
        isActive: true,
        isLocked: false,
      },
      select: { id: true },
    });
  });
  it('skips already notified deadlines before opening a transaction', async () => {
    prisma.assetWarrantyReminder.findMany.mockResolvedValue([
      { assetId: 2, warrantyDate: new Date('2026-10-22') },
    ]);
    await service.notifyExpiringWarranties();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['missing', 'changed', 'already-sent', 'no-recipients'])(
    'rechecks %s inside the transaction',
    async (state) => {
      if (state === 'missing') tx.asset.findFirst.mockResolvedValue(null);
      if (state === 'changed')
        tx.asset.findFirst.mockResolvedValue({
          ...asset,
          warrantyUntil: new Date('2026-11-01'),
        });
      if (state === 'already-sent')
        tx.assetWarrantyReminder.findUnique.mockResolvedValue({ assetId: 2 });
      if (state === 'no-recipients') tx.user.findMany.mockResolvedValue([]);
      await service.notifyExpiringWarranties();
      expect(tx.assetWarrantyReminder.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    },
  );
  it('does not overlap runs and restores the running guard after failure', async () => {
    prisma.asset.findMany.mockRejectedValueOnce(
      new Error('test database failure'),
    );
    await expect(service.notifyExpiringWarranties()).rejects.toThrow(
      'test database failure',
    );
    let release!: (assets: unknown[]) => void;
    prisma.asset.findMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.notifyExpiringWarranties();
    await service.notifyExpiringWarranties();
    release([]);
    await first;
    expect(prisma.asset.findMany).toHaveBeenCalledTimes(2);
  });
  it('keeps scanning after a fully notified batch so later assets cannot starve', async () => {
    const assets = Array.from({ length: 100 }, (_, index) => ({
      ...asset,
      id: index + 1,
    }));
    prisma.asset.findMany
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);
    prisma.assetWarrantyReminder.findMany.mockResolvedValue(
      assets.map((row) => ({
        assetId: row.id,
        warrantyDate: row.warrantyUntil,
      })),
    );
    await service.notifyExpiringWarranties();
    expect(prisma.asset.findMany).toHaveBeenLastCalledWith({
      where: {
        id: { gt: 100 },
        warrantyUntil: {
          gte: new Date('2026-10-18T17:00:00Z'),
          lt: new Date('2026-11-18T17:00:00Z'),
        },
        status: { notIn: ['RETIRED', 'LOST'] },
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, warrantyUntil: true },
    });
  });
  const listener = () =>
    new AssetWarrantyNotificationListener(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  it.each(['RETIRED', 'LOST', 'changed', 'missing'])(
    'discards stale queued reminders for %s',
    async (state) => {
      prisma.asset.findUnique.mockResolvedValue(
        state === 'missing'
          ? null
          : {
              ...asset,
              status: state,
              warrantyUntil:
                state === 'changed'
                  ? new Date('2026-11-01')
                  : asset.warrantyUntil,
            },
      );
      await listener().handle(event);
      expect(notifications.createdMany).not.toHaveBeenCalled();
    },
  );
  it('revalidates recipient roles and propagates the delivery deduplication ID', async () => {
    await listener().handle(event);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: { in: ['ADMIN', 'IT_STAFF'] },
        isActive: true,
        isLocked: false,
        id: { in: [1, 3] },
      },
      select: { id: true },
    });
    expect(notifications.createdMany).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1],
        type: 'ASSET_WARRANTY_EXPIRING',
        sourceEventId: 'event-1',
        targetUrl: '/assets/2',
      }),
    );
  });
});
