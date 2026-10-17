import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AssetMaintenanceService } from './asset-maintenance.service';
import {
  assetCareDates,
  parseAssetCareDate,
  warrantyWindow,
  warrantyCalendarDate,
} from './asset-care.util';
import {
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
} from './dto/asset-maintenance.dto';

describe('Asset maintenance', () => {
  const actor = { userId: 1, role: 'ADMIN' as const };
  const now = new Date('2026-10-18T17:30:00Z');
  const record = {
    id: 5,
    assetId: 2,
    title: 'Replace fan',
    status: 'PLANNED',
    kind: 'REPAIR',
    scheduledFor: new Date('2026-10-20'),
    vendor: 'Service',
    cost: null,
    notes: null,
    version: 0,
  };
  const input = {
    title: ' Replace fan ',
    kind: 'REPAIR' as const,
    scheduledFor: '2026-10-20',
    vendor: 'Service',
  };
  const tx = {
    asset: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    assetMaintenance: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn() };
  const audit = { create: jest.fn() };
  const service = new AssetMaintenanceService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogsService,
  );
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (work: ((db: typeof tx) => Promise<unknown>) | Promise<unknown>[]) =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
    );
    tx.asset.findUnique.mockResolvedValue({ id: 2, status: 'ASSIGNED' });
    tx.assetMaintenance.create.mockResolvedValue(record);
    tx.assetMaintenance.findFirst.mockResolvedValue(record);
    tx.assetMaintenance.updateMany.mockResolvedValue({ count: 1 });
    tx.assetMaintenance.findUniqueOrThrow.mockResolvedValue({
      ...record,
      version: 1,
    });
    tx.assetMaintenance.findMany.mockResolvedValue([record]);
    tx.assetMaintenance.count.mockResolvedValue(1);
    tx.asset.count.mockResolvedValue(0);
    tx.asset.findMany.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('uses Vietnam dates at UTC midnight without host timezone assumptions', () => {
    expect(warrantyCalendarDate(new Date('2026-10-18T17:00:00Z'))).toBe(
      '2026-10-19',
    );
    expect(warrantyWindow()).toEqual({
      start: new Date('2026-10-18T17:00:00Z'),
      end: new Date('2026-11-18T17:00:00Z'),
    });
    expect(assetCareDates()).toEqual({
      today: '2026-10-19',
      start: new Date('2026-10-19T00:00:00Z'),
      end: new Date('2026-11-19T00:00:00Z'),
    });
    expect(parseAssetCareDate('2024-02-29')).toEqual(new Date('2024-02-29'));
    for (const date of ['2026-02-29', '2026-02-30', '2026-1-01', 'bad'])
      expect(() => parseAssetCareDate(date)).toThrow();
  });
  it.each(['EMPLOYEE', 'MANAGER'] as const)(
    'protects maintenance cost data from %s',
    async (role) => {
      await expect(service.list(2, {}, { userId: 4, role })).rejects.toThrow(
        'Forbidden',
      );
      await expect(
        service.create(2, input, { userId: 4, role }),
      ).rejects.toThrow('Forbidden');
      await expect(service.overview({ userId: 4, role })).rejects.toThrow(
        'Forbidden',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('schedules an assigned asset without changing assignment or operational status and audits atomically', async () => {
    await service.create(2, input, actor);
    expect(tx.assetMaintenance.create).toHaveBeenCalledWith({
      data: {
        assetId: 2,
        title: 'Replace fan',
        kind: 'REPAIR',
        scheduledFor: new Date('2026-10-20'),
        vendor: 'Service',
        notes: null,
        createdById: 1,
      },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'ASSET',
        entityId: 2,
        action: 'CREATE',
      }),
      tx,
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });
  it.each(['RETIRED', 'LOST'])(
    'does not create schedules for %s assets',
    async (status) => {
      tx.asset.findUnique.mockResolvedValue({ id: 2, status });
      await expect(service.create(2, input, actor)).rejects.toThrow(
        'lost or retired',
      );
      expect(tx.assetMaintenance.create).not.toHaveBeenCalled();
    },
  );
  it('rejects missing assets, blank titles, nonexistent dates and nonexistent records', async () => {
    tx.asset.findUnique.mockResolvedValue(null);
    await expect(service.create(2, input, actor)).rejects.toThrow(
      'Asset not found',
    );
    await expect(
      service.create(2, { ...input, title: '  ' }, actor),
    ).rejects.toThrow('two characters');
    await expect(
      service.create(2, { ...input, scheduledFor: '2026-02-30' }, actor),
    ).rejects.toThrow('valid YYYY');
    tx.assetMaintenance.findFirst.mockResolvedValue(null);
    await expect(service.cancel(2, 5, { version: 0 }, actor)).rejects.toThrow(
      'not found',
    );
  });
  it('reschedules only the expected version of the matching asset record', async () => {
    await service.update(
      2,
      5,
      { version: 0, scheduledFor: '2026-10-21', vendor: null },
      actor,
    );
    expect(tx.assetMaintenance.findFirst).toHaveBeenCalledWith({
      where: { id: 5, assetId: 2 },
    });
    expect(tx.assetMaintenance.updateMany).toHaveBeenCalledWith({
      where: { id: 5, assetId: 2, status: 'PLANNED', version: 0 },
      data: {
        title: undefined,
        kind: undefined,
        notes: null,
        scheduledFor: new Date('2026-10-21'),
        vendor: null,
        version: { increment: 1 },
      },
    });
    await expect(
      service.update(2, 5, { version: 0, title: ' ' }, actor),
    ).rejects.toThrow('two characters');
  });
  it.each([
    { status: 'COMPLETED', version: 0 },
    { status: 'CANCELLED', version: 0 },
    { status: 'PLANNED', version: 1 },
  ])('rejects stale/finalized records: %p', async (state) => {
    tx.assetMaintenance.findFirst.mockResolvedValue({ ...record, ...state });
    await expect(service.cancel(2, 5, { version: 0 }, actor)).rejects.toThrow(
      'Reload',
    );
    expect(tx.assetMaintenance.updateMany).not.toHaveBeenCalled();
  });
  it('does not audit an update when the conditional claim loses a race', async () => {
    tx.assetMaintenance.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancel(2, 5, { version: 0 }, actor)).rejects.toThrow(
      'Reload',
    );
    expect(audit.create).not.toHaveBeenCalled();
  });
  it.each([null, '0', '999999999999'])(
    'records VND cost %p without inventing unknown costs or changing asset status',
    async (cost) => {
      await service.complete(
        2,
        5,
        { version: 0, performedOn: '2026-10-19', cost },
        actor,
      );
      expect(tx.assetMaintenance.updateMany).toHaveBeenCalledWith({
        where: { id: 5, assetId: 2, status: 'PLANNED', version: 0 },
        data: {
          status: 'COMPLETED',
          performedOn: new Date('2026-10-19'),
          completedAt: now,
          completedById: 1,
          cost: cost === null ? null : new Prisma.Decimal(cost),
          vendor: 'Service',
          notes: null,
          version: { increment: 1 },
        },
      });
    },
  );
  it('rejects a future performed date and retains cancellation history', async () => {
    await expect(
      service.complete(2, 5, { version: 0, performedOn: '2026-10-20' }, actor),
    ).rejects.toThrow('future');
    await service.cancel(2, 5, { version: 0 }, actor);
    expect(tx.assetMaintenance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CANCELLED', version: { increment: 1 } },
      }),
    );
  });
  it('paginates history and separates overview windows from expired warranty', async () => {
    await expect(
      service.list(2, { page: 2, limit: 5, status: 'COMPLETED' }, actor),
    ).resolves.toMatchObject({
      pagination: { page: 2, limit: 5, totalItems: 1 },
    });
    expect(tx.assetMaintenance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetId: 2, status: 'COMPLETED' },
        skip: 5,
        take: 5,
      }),
    );
    const overview = await service.overview(actor);
    expect(overview).toMatchObject({ today: '2026-10-19', reminderDays: 30 });
    expect(tx.asset.count).toHaveBeenCalledWith({
      where: {
        status: { notIn: ['RETIRED', 'LOST'] },
        warrantyUntil: {
          gte: new Date('2026-10-18T17:00:00Z'),
          lt: new Date('2026-11-18T17:00:00Z'),
        },
      },
    });
  });
  it('validates enum/null, versions, cost integer precision and date syntax in DTOs', async () => {
    for (const value of [
      { ...input, kind: 'OTHER' },
      { ...input, title: 'x' },
      { ...input, scheduledFor: '2026-1-01' },
    ])
      expect(
        (await validate(plainToInstance(CreateMaintenanceDto, value))).length,
      ).toBeGreaterThan(0);
    for (const value of [
      { version: 0, kind: null },
      { version: 0, scheduledFor: null },
      { version: -1 },
    ])
      expect(
        (await validate(plainToInstance(UpdateMaintenanceDto, value))).length,
      ).toBeGreaterThan(0);
    for (const cost of ['-1', '0.5', '01', '1000000000000', 100])
      expect(
        (
          await validate(
            plainToInstance(CompleteMaintenanceDto, {
              version: 0,
              performedOn: '2026-10-19',
              cost,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(CompleteMaintenanceDto, {
          version: 0,
          performedOn: '2026-10-19',
          cost: '0',
        }),
      ),
    ).toHaveLength(0);
  });
});
