import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlaPolicyService } from '../sla/sla-policy.service';
import { DEFAULT_SLA_POLICY } from '../sla/sla-policy';
import { LeavePlanningService } from './leave-planning.service';

describe('Leave planning', () => {
  const employee = { userId: 3, role: 'EMPLOYEE' as const };
  const admin = { userId: 1, role: 'ADMIN' as const };
  const db = {
    user: { findUnique: jest.fn() },
    leaveEntitlement: { findUnique: jest.fn(), upsert: jest.fn() },
    leaveDay: { findMany: jest.fn() },
    leaveRequest: {
      count: jest.fn(),
      findMany: jest.fn<
        Promise<unknown[]>,
        [Prisma.LeaveRequestFindManyArgs]
      >(),
    },
    $transaction: jest.fn(),
  };
  const tx = db as unknown as Prisma.TransactionClient;
  const policies = { get: jest.fn() };
  const audit = { create: jest.fn() };
  const service = new LeavePlanningService(
    db as unknown as PrismaService,
    policies as unknown as SlaPolicyService,
    audit as unknown as AuditLogsService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((work: unknown) =>
      Array.isArray(work)
        ? Promise.all(work as Promise<unknown>[])
        : (work as (tx: Prisma.TransactionClient) => Promise<unknown>)(tx),
    );
    db.user.findUnique.mockResolvedValue({ id: 3, departmentId: 8 });
    db.leaveEntitlement.findUnique.mockResolvedValue(null);
    db.leaveDay.findMany.mockResolvedValue([]);
    db.leaveRequest.count.mockResolvedValue(0);
    db.leaveRequest.findMany.mockResolvedValue([]);
    policies.get.mockResolvedValue({
      config: structuredClone(DEFAULT_SLA_POLICY),
    });
  });
  it('keeps unknown allowance distinct from zero and reports legacy requests', async () => {
    db.leaveRequest.count.mockResolvedValue(2);
    expect(await service.balance(tx, 3, 2026)).toMatchObject({
      allowance: null,
      remaining: null,
      used: 0,
      reserved: 0,
      legacyRequests: 2,
    });
    db.leaveEntitlement.findUnique.mockResolvedValue({
      halfDays: 0,
      version: 1,
    });
    expect(await service.balance(tx, 3, 2026)).toMatchObject({
      allowance: 0,
      remaining: 0,
    });
  });
  it('counts pending reservations separately from approved use, without rounding', async () => {
    db.leaveEntitlement.findUnique.mockResolvedValue({
      halfDays: 24,
      version: 1,
    });
    db.leaveDay.findMany.mockResolvedValue([
      { halfDays: 1, request: { status: 'PENDING' } },
      { halfDays: 2, request: { status: 'APPROVED' } },
    ]);
    expect(await service.balance(tx, 3, 2026)).toMatchObject({
      allowance: 12,
      used: 1,
      reserved: 0.5,
      remaining: 10.5,
    });
  });
  it('blocks annual leave without a configured allowance or with insufficient balance', async () => {
    const days = [{ date: new Date('2026-10-19T00:00:00Z'), halfDays: 1 }];
    await expect(service.assertAvailable(tx, 3, days)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    db.leaveEntitlement.findUnique.mockResolvedValue({
      halfDays: 0,
      version: 1,
    });
    await expect(service.assertAvailable(tx, 3, days)).rejects.toBeInstanceOf(
      ConflictException,
    );
    db.leaveEntitlement.findUnique.mockResolvedValue({
      halfDays: 1,
      version: 1,
    });
    await expect(service.assertAvailable(tx, 3, days)).resolves.toBeUndefined();
  });
  it('requires a separate allowance for every year instead of transferring balances', async () => {
    db.leaveEntitlement.findUnique
      .mockResolvedValueOnce({ halfDays: 10, version: 1 })
      .mockResolvedValueOnce(null);
    await expect(
      service.assertAvailable(tx, 3, [
        { date: new Date('2026-12-31T00:00:00Z'), halfDays: 2 },
        { date: new Date('2027-01-01T00:00:00Z'), halfDays: 2 },
      ]),
    ).rejects.toThrow('2027');
  });
  it('allows only self or ADMIN to view private balances', async () => {
    await expect(
      service.getBalance({ year: 2026, userId: 4 }, employee),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
    await expect(
      service.getBalance({ year: 2026 }, employee),
    ).resolves.toMatchObject({ userId: 3 });
  });
  it('checks role, version and reservations before changing an allowance', async () => {
    const dto = { days: 10, version: 1 };
    await expect(
      service.setEntitlement(3, 2026, dto, employee),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setEntitlement(3, 2026, dto, admin)).rejects.toThrow(
      'changed',
    );
    db.leaveEntitlement.findUnique.mockResolvedValue({
      halfDays: 24,
      version: 1,
    });
    db.leaveDay.findMany.mockResolvedValue([
      { halfDays: 24, request: { status: 'PENDING' } },
    ]);
    await expect(service.setEntitlement(3, 2026, dto, admin)).rejects.toThrow(
      'lower',
    );
    expect(db.leaveEntitlement.upsert).not.toHaveBeenCalled();
  });
  it('writes half-day precision with the audit in the same transaction and rolls back audit failures', async () => {
    await service.setEntitlement(3, 2026, { days: 12.5, version: 0 }, admin);
    expect(db.leaveEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 3, year: 2026, halfDays: 25 },
      }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'LEAVE_REQUEST' }),
      tx,
    );
    audit.create.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      service.setEntitlement(3, 2026, { days: 12.5, version: 0 }, admin),
    ).rejects.toThrow('audit unavailable');
  });
  it('scopes team calendars to the department and omits private reasons and types', async () => {
    await expect(
      service.calendar(
        { month: '2026-10', departmentId: 9, page: 1 },
        employee,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.calendar({ month: '2026-10', page: 2 }, employee);
    const query = db.leaveRequest.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ requester: { departmentId: 8 } });
    expect(query.select).not.toHaveProperty('reason');
    expect(query.select).not.toHaveProperty('type');
    expect(query).toMatchObject({ skip: 100, take: 100 });
  });
  it('returns an explicit empty calendar for users without a department', async () => {
    db.user.findUnique.mockResolvedValue({ departmentId: null });
    expect(
      await service.calendar({ month: '2026-10', page: 1 }, employee),
    ).toMatchObject({ departmentId: null, totalItems: 0 });
    expect(db.leaveRequest.findMany).not.toHaveBeenCalled();
  });
});
