import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './accounts.service';

const mockUserModel = {
  findUnique: jest.fn<Promise<unknown>, [unknown]>(),
  updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockRefreshTokenModel = {
  updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockTransactionClient = {
  user: mockUserModel,
  refreshToken: mockRefreshTokenModel,
};

const mockPrismaService = {
  user: mockUserModel,
  $transaction: jest.fn<
    Promise<unknown>,
    [(transaction: typeof mockTransactionClient) => Promise<unknown>]
  >(),
};

const mockAuditLogsService = {
  create: jest.fn<Promise<unknown>, [unknown, unknown]>(),
};

const baseUser = {
  id: 2,
  name: 'Target User',
  email: 'target@officeflow.com',
  role: UserRole.EMPLOYEE,
  isActive: true,
  isLocked: false,
  lockedAt: null,
  lockedById: null,
  unlockedAt: null,
  unlockedById: null,
  departmentId: 1,
  createdAt: new Date(),
  department: {
    id: 1,
    name: 'Engineering',
  },
};

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockUserModel.updateMany.mockResolvedValue({ count: 1 });
    mockRefreshTokenModel.updateMany.mockResolvedValue({ count: 1 });
    mockAuditLogsService.create.mockResolvedValue({});
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockTransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it.each([
    [UserRole.ADMIN, UserRole.EMPLOYEE],
    [UserRole.ADMIN, UserRole.MANAGER],
    [UserRole.ADMIN, UserRole.IT_STAFF],
    [UserRole.IT_STAFF, UserRole.EMPLOYEE],
    [UserRole.IT_STAFF, UserRole.MANAGER],
    [UserRole.IT_STAFF, UserRole.IT_STAFF],
  ])('allows %s to lock %s', async (actorRole, targetRole) => {
    const target = { ...baseUser, role: targetRole };
    const updated = {
      ...target,
      isLocked: true,
      lockedAt: new Date(),
      lockedById: 1,
    };
    mockUserModel.findUnique
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(updated);

    await expect(
      service.lockUser({ userId: 1, role: actorRole }, target.id),
    ).resolves.toEqual(updated);

    const revokeArgs = mockRefreshTokenModel.updateMany.mock.calls[0][0] as {
      where: {
        userId: number;
        revokedAt: null;
      };
      data: {
        revokedAt: Date;
      };
    };
    expect(revokeArgs).toEqual({
      where: {
        userId: target.id,
        revokedAt: null,
      },
      data: {
        revokedAt: revokeArgs.data.revokedAt,
      },
    });
    expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        entityId: target.id,
      }),
      mockTransactionClient,
    );
  });

  it.each([UserRole.ADMIN, UserRole.IT_STAFF])(
    'forbids %s from locking an ADMIN account',
    async (actorRole) => {
      mockUserModel.findUnique.mockResolvedValue({
        ...baseUser,
        role: UserRole.ADMIN,
      });

      await expect(
        service.lockUser({ userId: 1, role: actorRole }, baseUser.id),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    },
  );

  it('forbids an actor from changing their own lock state', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      ...baseUser,
      id: 1,
      role: UserRole.IT_STAFF,
    });

    await expect(
      service.lockUser({ userId: 1, role: UserRole.IT_STAFF }, 1),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forbids roles that cannot manage account locks', async () => {
    mockUserModel.findUnique.mockResolvedValue(baseUser);

    await expect(
      service.lockUser({ userId: 1, role: UserRole.MANAGER }, baseUser.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the target does not exist', async () => {
    mockUserModel.findUnique.mockResolvedValue(null);

    await expect(
      service.lockUser({ userId: 1, role: UserRole.ADMIN }, 999),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the current state without updating an already locked user', async () => {
    const lockedUser = {
      ...baseUser,
      isLocked: true,
      lockedAt: new Date(),
      lockedById: 1,
    };
    mockUserModel.findUnique.mockResolvedValue(lockedUser);

    await expect(
      service.lockUser({ userId: 1, role: UserRole.ADMIN }, lockedUser.id),
    ).resolves.toEqual(lockedUser);
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('unlocks a user and records unlock metadata in the audit log', async () => {
    const lockedUser = {
      ...baseUser,
      isLocked: true,
      lockedAt: new Date(),
      lockedById: 1,
    };
    const unlockedUser = {
      ...lockedUser,
      isLocked: false,
      unlockedAt: new Date(),
      unlockedById: 3,
    };
    mockUserModel.findUnique
      .mockResolvedValueOnce(lockedUser)
      .mockResolvedValueOnce(unlockedUser);

    await expect(
      service.unlockUser({ userId: 3, role: UserRole.IT_STAFF }, lockedUser.id),
    ).resolves.toEqual(unlockedUser);

    expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
    const auditValues = mockAuditLogsService.create.mock.calls[0][0] as {
      newValues: {
        isLocked: boolean;
        unlockedAt: Date | null;
        unlockedById: number | null;
      };
    };
    expect(auditValues.newValues).toEqual(
      expect.objectContaining({
        isLocked: false,
        unlockedAt: unlockedUser.unlockedAt,
        unlockedById: 3,
      }),
    );
    expect(mockAuditLogsService.create.mock.calls[0][1]).toBe(
      mockTransactionClient,
    );
  });

  it('returns the concurrent result when another request already locked the user', async () => {
    const lockedUser = {
      ...baseUser,
      isLocked: true,
      lockedAt: new Date(),
      lockedById: 3,
    };
    mockUserModel.findUnique
      .mockResolvedValueOnce(baseUser)
      .mockResolvedValueOnce(lockedUser);
    mockUserModel.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.lockUser({ userId: 1, role: UserRole.ADMIN }, baseUser.id),
    ).resolves.toEqual(lockedUser);
    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
  });
});
