import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './accounts.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockBcryptCompare = bcrypt.compare as unknown as jest.Mock<
  Promise<boolean>,
  [string, string]
>;
const mockBcryptHash = bcrypt.hash as unknown as jest.Mock<
  Promise<string>,
  [string, number]
>;

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

const mockEventEmitter = {
  emit: jest.fn(),
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
  mustChangePassword: false,
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
    mockBcryptCompare.mockResolvedValue(true);
    mockBcryptHash.mockResolvedValue('new-password-hash');
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
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
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

  it.each([
    [UserRole.ADMIN, UserRole.EMPLOYEE],
    [UserRole.ADMIN, UserRole.MANAGER],
    [UserRole.ADMIN, UserRole.IT_STAFF],
    [UserRole.IT_STAFF, UserRole.EMPLOYEE],
    [UserRole.IT_STAFF, UserRole.MANAGER],
    [UserRole.IT_STAFF, UserRole.IT_STAFF],
  ])('allows %s to reset %s password', async (actorRole, targetRole) => {
    const target = { ...baseUser, role: targetRole };
    const updated = { ...target, mustChangePassword: true };
    mockUserModel.findUnique
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(updated);

    await expect(
      service.resetPassword(
        target.id,
        { password: 'temporary-password-123' },
        { userId: 1, role: actorRole },
      ),
    ).resolves.toEqual(updated);

    expect(mockUserModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: target.id,
          role: {
            in: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.IT_STAFF],
          },
        },
        data: {
          passwordHash: 'new-password-hash',
          mustChangePassword: true,
        },
      }),
    );
    expect(mockRefreshTokenModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: target.id, revokedAt: null },
      }),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'user.password-reset',
      expect.objectContaining({ userId: target.id }),
    );
    expect(
      JSON.stringify(mockAuditLogsService.create.mock.calls),
    ).not.toContain('temporary-password-123');
  });

  it.each([UserRole.ADMIN, UserRole.IT_STAFF])(
    'forbids %s from resetting an ADMIN password',
    async (actorRole) => {
      mockUserModel.findUnique.mockResolvedValue({
        ...baseUser,
        role: UserRole.ADMIN,
      });

      await expect(
        service.resetPassword(
          baseUser.id,
          { password: 'temporary-password-123' },
          { userId: 1, role: actorRole },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    },
  );

  it('forbids resetting your own password through the administrative operation', async () => {
    mockUserModel.findUnique.mockResolvedValue({ ...baseUser, id: 1 });

    await expect(
      service.resetPassword(
        1,
        { password: 'temporary-password-123' },
        { userId: 1, role: UserRole.IT_STAFF },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('changes the current password, clears the forced-change flag, and revokes sessions', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@officeflow.com',
      passwordHash: 'current-password-hash',
      mustChangePassword: true,
    });

    await expect(
      service.changeOwnPassword(
        {
          currentPassword: 'temporary-password-123',
          newPassword: 'new-secure-password-456',
        },
        { userId: 1, role: UserRole.EMPLOYEE },
      ),
    ).resolves.toEqual({
      passwordChanged: true,
      mustChangePassword: false,
    });

    expect(mockUserModel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        passwordHash: 'current-password-hash',
      },
      data: {
        passwordHash: 'new-password-hash',
        mustChangePassword: false,
      },
    });
    expect(mockRefreshTokenModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1, revokedAt: null } }),
    );
    expect(
      JSON.stringify(mockAuditLogsService.create.mock.calls),
    ).not.toContain('new-secure-password-456');
  });

  it('rejects an incorrect current password before hashing', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@officeflow.com',
      passwordHash: 'current-password-hash',
      mustChangePassword: false,
    });
    mockBcryptCompare.mockResolvedValue(false);

    await expect(
      service.changeOwnPassword(
        { currentPassword: 'wrong-password', newPassword: 'new-password-123' },
        { userId: 1, role: UserRole.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@officeflow.com',
      passwordHash: 'current-password-hash',
      mustChangePassword: false,
    });

    await expect(
      service.changeOwnPassword(
        {
          currentPassword: 'same-password-123',
          newPassword: 'same-password-123',
        },
        { userId: 1, role: UserRole.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockBcryptHash).not.toHaveBeenCalled();
  });

  it('rejects a concurrent password change', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@officeflow.com',
      passwordHash: 'current-password-hash',
      mustChangePassword: false,
    });
    mockUserModel.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.changeOwnPassword(
        {
          currentPassword: 'current-password-123',
          newPassword: 'new-password-456',
        },
        { userId: 1, role: UserRole.EMPLOYEE },
      ),
    ).rejects.toThrow(ConflictException);
    expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
  });
});
