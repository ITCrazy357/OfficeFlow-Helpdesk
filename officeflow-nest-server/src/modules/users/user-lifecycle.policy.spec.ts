import { ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import {
  assertActiveAdmin,
  assertAnotherUsableAdmin,
} from './user-lifecycle.policy';
import {
  assertNoPendingHandoff,
  assertRoleHandoff,
} from './user-handoff.policy';

describe('User lifecycle policies', () => {
  const models = {
    user: { findUnique: jest.fn(), count: jest.fn() },
    ticket: { count: jest.fn() },
    asset: { count: jest.fn() },
    leaveRequest: { count: jest.fn() },
  };
  const tx = models as unknown as Prisma.TransactionClient;
  beforeEach(() => {
    jest.resetAllMocks();
    for (const model of Object.values(models)) model.count.mockResolvedValue(0);
  });

  it.each([
    null,
    { role: UserRole.EMPLOYEE, isActive: true, isLocked: false },
    { role: UserRole.ADMIN, isActive: false, isLocked: false },
    { role: UserRole.ADMIN, isActive: true, isLocked: true },
  ])('rejects an unavailable actor: %j', async (actor) => {
    models.user.findUnique.mockResolvedValue(actor);
    await expect(assertActiveAdmin(tx, 1)).rejects.toThrow(ForbiddenException);
  });

  it('accepts an active unlocked ADMIN', async () => {
    models.user.findUnique.mockResolvedValue({
      role: UserRole.ADMIN,
      isActive: true,
      isLocked: false,
    });
    await expect(assertActiveAdmin(tx, 1)).resolves.toBeUndefined();
  });

  it('counts only another active unlocked ADMIN', async () => {
    await expect(assertAnotherUsableAdmin(tx, 2)).rejects.toThrow(
      ConflictException,
    );
    expect(models.user.count).toHaveBeenCalledWith({
      where: {
        id: { not: 2 },
        role: UserRole.ADMIN,
        isActive: true,
        isLocked: false,
      },
    });
    models.user.count.mockResolvedValue(1);
    await expect(assertAnotherUsableAdmin(tx, 2)).resolves.toBeUndefined();
  });

  it.each(['ticket', 'asset', 'leaveRequest', 'user'] as const)(
    'blocks outstanding %s handoff',
    async (model) => {
      models[model].count.mockResolvedValue(1);
      await expect(assertNoPendingHandoff(tx, 2)).rejects.toThrow(
        ConflictException,
      );
    },
  );

  it('counts current responsibilities rather than historical ownership', async () => {
    await expect(assertNoPendingHandoff(tx, 2)).resolves.toBeUndefined();
    expect(models.ticket.count).toHaveBeenCalledWith({
      where: { assignedToId: 2, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    });
    expect(models.asset.count).toHaveBeenCalledWith({
      where: { assignedToId: 2 },
    });
    expect(models.leaveRequest.count).toHaveBeenCalledWith({
      where: { approverId: 2, status: 'PENDING' },
    });
    expect(models.user.count).toHaveBeenCalledWith({
      where: { managerId: 2, isActive: true },
    });
  });

  it('blocks losing ticket permissions while assigned active tickets', async () => {
    models.ticket.count.mockResolvedValue(1);
    await expect(assertRoleHandoff(tx, 2, UserRole.MANAGER)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      assertRoleHandoff(tx, 2, UserRole.IT_STAFF),
    ).resolves.toBeUndefined();
  });

  it.each(['leaveRequest', 'user'] as const)(
    'blocks losing approval permissions with outstanding %s',
    async (model) => {
      models[model].count.mockResolvedValue(1);
      await expect(assertRoleHandoff(tx, 2, UserRole.IT_STAFF)).rejects.toThrow(
        ConflictException,
      );
      await expect(
        assertRoleHandoff(tx, 2, UserRole.MANAGER),
      ).resolves.toBeUndefined();
    },
  );
});
