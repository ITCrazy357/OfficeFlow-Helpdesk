import { AssetStatus } from '@prisma/client';
import { AssetsService } from './assets.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('AssetsService assignment lifecycle', () => {
  const asset = {
    id: 5,
    assetTag: 'LAP-5',
    name: 'Laptop',
    status: AssetStatus.AVAILABLE,
    assignedToId: null,
  };
  const tx = {
    user: { findUnique: jest.fn() },
    asset: { findUnique: jest.fn(), updateMany: jest.fn() },
    assetAssignment: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn(), user: { findUnique: jest.fn() } };
  const audit = { create: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const service = new AssetsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogsService,
    outbox,
  );
  const actor = { userId: 1, role: 'ADMIN' as const };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (transaction: typeof tx) => Promise<unknown>) => work(tx),
    );
    tx.asset.findUnique.mockResolvedValue(asset);
    tx.asset.updateMany.mockResolvedValue({ count: 1 });
    tx.assetAssignment.create.mockResolvedValue({ id: 10 });
    tx.user.findUnique.mockResolvedValue({
      id: 2,
      name: 'Employee',
      isActive: true,
      isLocked: false,
    });
  });

  it.each([
    { isActive: false, isLocked: false },
    { isActive: true, isLocked: true },
  ])(
    'rejects an unavailable recipient inside the transaction: %j',
    async (state) => {
      tx.user.findUnique.mockResolvedValue({ id: 2, ...state });
      await expect(service.assign(5, { userId: 2 }, actor)).rejects.toThrow();
      expect(tx.asset.updateMany).not.toHaveBeenCalled();
      expect(audit.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    },
  );

  it('retains the conditional claim and writes history/audit/outbox inside the transaction', async () => {
    await service.assign(5, { userId: 2 }, actor);
    expect(tx.asset.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'AVAILABLE', assignedToId: null },
      data: { status: 'ASSIGNED', assignedToId: 2 },
    });
    expect(tx.assetAssignment.create).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'asset.assigned' }),
    );
  });

  it('does not write history or events when the asset claim loses a race', async () => {
    tx.asset.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.assign(5, { userId: 2 }, actor)).rejects.toThrow(
      'no longer available',
    );
    expect(tx.assetAssignment.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
