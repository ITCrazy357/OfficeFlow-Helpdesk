import { AssetStatus, AssetType, UserRole } from '@prisma/client';
import { AssetsService } from './assets.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('AssetsService operations', () => {
  const asset = {
    id: 5,
    assetTag: 'LAP-5',
    name: 'Laptop',
    type: AssetType.LAPTOP,
    status: AssetStatus.AVAILABLE,
    assignedToId: null,
  };
  const tx = {
    asset: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    assetAssignment: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    asset: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const audit = { create: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const actor = { userId: 1, role: UserRole.ADMIN };
  const service = new AssetsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogsService,
    outbox,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    prisma.asset.findUnique.mockResolvedValue(asset);
    prisma.user.findUnique.mockResolvedValue({ name: 'Admin' });
    tx.asset.findUnique.mockResolvedValue(asset);
    tx.asset.updateMany.mockResolvedValue({ count: 1 });
    tx.assetAssignment.findFirst.mockResolvedValue({ id: 10 });
    tx.assetAssignment.updateMany.mockResolvedValue({ count: 1 });
  });
  it('rejects duplicate tags before creating an asset', async () => {
    await expect(
      service.create(
        { assetTag: 'LAP-5', name: 'Laptop', type: AssetType.LAPTOP },
        actor,
      ),
    ).rejects.toThrow('Asset tag already exists');
    expect(tx.asset.create).not.toHaveBeenCalled();
  });
  it('creates an asset and audit inside the same transaction', async () => {
    prisma.asset.findUnique.mockResolvedValue(null);
    tx.asset.create.mockResolvedValue(asset);
    await expect(
      service.create(
        { assetTag: 'LAP-5', name: 'Laptop', type: AssetType.LAPTOP },
        actor,
      ),
    ).resolves.toEqual(asset);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' }),
      tx,
    );
  });
  it('rejects empty updates', async () => {
    await expect(service.update(5, {}, actor)).rejects.toThrow(
      'At least one field',
    );
    expect(tx.asset.update).not.toHaveBeenCalled();
  });
  it('scopes personal assets to the caller', async () => {
    await service.findMine(7);
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedToId: 7 } }),
    );
  });
  it('does not expose another employee asset', async () => {
    await expect(
      service.findOne(5, { userId: 7, role: UserRole.EMPLOYEE }),
    ).rejects.toThrow('permission');
  });
  it('returns an assigned asset, closes history and enqueues the event atomically', async () => {
    prisma.asset.findUnique.mockResolvedValue({
      ...asset,
      status: AssetStatus.ASSIGNED,
      assignedToId: 2,
    });
    await service.returnAsset(5, { notes: 'Returned' }, actor);
    expect(tx.asset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, status: 'ASSIGNED', assignedToId: 2 },
      }),
    );
    expect(tx.assetAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10, returnedAt: null } }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURNED' }),
      tx,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: 'asset.returned' }),
    );
  });
  it('rejects a return with no open assignment history', async () => {
    prisma.asset.findUnique.mockResolvedValue({
      ...asset,
      status: AssetStatus.ASSIGNED,
      assignedToId: 2,
    });
    tx.assetAssignment.findFirst.mockResolvedValue(null);
    await expect(service.returnAsset(5, {}, actor)).rejects.toThrow(
      'history was not found',
    );
    expect(tx.asset.updateMany).not.toHaveBeenCalled();
  });
  it('propagates a failed conditional return without audit or event', async () => {
    prisma.asset.findUnique.mockResolvedValue({
      ...asset,
      status: AssetStatus.ASSIGNED,
      assignedToId: 2,
    });
    tx.asset.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.returnAsset(5, {}, actor)).rejects.toThrow(
      'assignment has changed',
    );
    expect(audit.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
  it('rejects status changes for an assigned asset', async () => {
    prisma.asset.findUnique.mockResolvedValue({
      ...asset,
      status: AssetStatus.ASSIGNED,
      assignedToId: 2,
    });
    await expect(
      service.changeStatus(5, { status: AssetStatus.MAINTENANCE }, actor),
    ).rejects.toThrow('Return the asset');
    expect(tx.asset.updateMany).not.toHaveBeenCalled();
  });
  it('changes an available asset status and records an audit', async () => {
    tx.asset.findUnique.mockResolvedValue({
      ...asset,
      status: AssetStatus.MAINTENANCE,
    });
    await service.changeStatus(5, { status: AssetStatus.MAINTENANCE }, actor);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STATUS_CHANGED' }),
      tx,
    );
  });
});
