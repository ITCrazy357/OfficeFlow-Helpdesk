import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditLogAction,
  AuditLogEntity,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const mockBcryptHash = bcrypt.hash as unknown as jest.Mock<
  Promise<string>,
  [string, number]
>;

const mockUserModel = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockDepartmentModel = {
  findUnique: jest.fn(),
};

const mockRefreshTokenModel = {
  updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockPasswordResetTokenModel = {
  deleteMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockTransactionClient = {
  user: {
    ...mockUserModel,
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  department: mockDepartmentModel,
  ticket: { count: jest.fn() },
  asset: { count: jest.fn() },
  leaveRequest: { count: jest.fn(), updateMany: jest.fn() },
  refreshToken: mockRefreshTokenModel,
  passwordResetToken: mockPasswordResetTokenModel,
};

const mockPrismaService = {
  user: mockUserModel,
  department: mockDepartmentModel,
  refreshToken: mockRefreshTokenModel,
  $transaction: jest.fn<
    Promise<unknown>,
    [(transaction: typeof mockTransactionClient) => Promise<unknown>]
  >(),
};

const mockAuditLogsService = {
  create: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  emitAsync: jest.fn().mockResolvedValue([]),
};

const mockOutboxService = {
  enqueue: jest.fn().mockResolvedValue({ id: 'outbox-event-id' }),
};

const currentUser = {
  userId: 1,
  role: UserRole.ADMIN,
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

const storedUser = {
  id: 2,
  name: 'Employee',
  email: 'employee@officeflow.com',
  role: UserRole.EMPLOYEE,
  isActive: true,
  isLocked: false,
  lockedAt: null,
  lockedById: null,
  unlockedAt: null,
  unlockedById: null,
  departmentId: 1,
  managerId: null,
  createdAt: new Date(),
  department: {
    id: 1,
    name: 'Engineering',
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockTransactionClient.user.findUnique.mockImplementation(
      (args: { where: { id: number } }) =>
        args.where.id === currentUser.userId
          ? Promise.resolve({
              ...storedUser,
              id: currentUser.userId,
              role: UserRole.ADMIN,
            })
          : (mockUserModel.findUnique(args) as Promise<unknown>),
    );
    mockTransactionClient.user.findUniqueOrThrow.mockResolvedValue({
      manager: null,
      managerId: null,
    });
    mockTransactionClient.user.count.mockResolvedValue(0);
    mockTransactionClient.ticket.count.mockResolvedValue(0);
    mockTransactionClient.asset.count.mockResolvedValue(0);
    mockTransactionClient.leaveRequest.count.mockResolvedValue(0);
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPasswordResetTokenModel.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockTransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
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
        {
          provide: OutboxService,
          useValue: mockOutboxService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user and audit the operation in one transaction', async () => {
    const dto = {
      name: ' Employee ',
      email: 'EMPLOYEE@officeflow.com',
      password: 'strong-password-123',
      role: UserRole.EMPLOYEE,
      departmentId: 1,
    };

    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.department.findUnique.mockResolvedValue({ id: 1 });
    mockPrismaService.user.create.mockResolvedValue(storedUser);

    await expect(service.create(dto, currentUser)).resolves.toEqual(storedUser);

    expect(mockPrismaService.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Employee',
          email: 'employee@officeflow.com',
          passwordHash: 'hashed-password',
          role: UserRole.EMPLOYEE,
          departmentId: 1,
        },
      }),
    );
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: currentUser.userId,
        entity: AuditLogEntity.USER,
        entityId: storedUser.id,
        action: AuditLogAction.CREATE,
      }),
      mockTransactionClient,
    );
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransactionClient,
      expect.objectContaining({
        type: 'user.created',
        payload: { userId: storedUser.id },
      }),
    );
  });

  it('should reject a duplicate email', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({ id: 2 });
    mockPrismaService.department.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.create(
        {
          name: 'Employee',
          email: storedUser.email,
          password: 'strong-password-123',
          role: UserRole.EMPLOYEE,
          departmentId: 1,
        },
        currentUser,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject an unknown department', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.department.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'Employee',
          email: storedUser.email,
          password: 'strong-password-123',
          role: UserRole.EMPLOYEE,
          departmentId: 999,
        },
        currentUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should invalidate password reset tokens when the email changes', async () => {
    const updatedUser = {
      ...storedUser,
      email: 'new-email@officeflow.com',
    };
    mockPrismaService.user.findUnique.mockResolvedValue(storedUser);
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    mockPrismaService.user.update.mockResolvedValue(updatedUser);

    await expect(
      service.update(
        storedUser.id,
        { email: ' NEW-EMAIL@officeflow.com ' },
        currentUser,
      ),
    ).resolves.toEqual(updatedUser);

    expect(mockPasswordResetTokenModel.deleteMany).toHaveBeenCalledWith({
      where: { userId: storedUser.id },
    });
  });

  it('should deactivate a user without changing the lock state', async () => {
    const deactivatedUser = {
      ...storedUser,
      isActive: false,
    };
    mockPrismaService.user.findUnique.mockResolvedValue(storedUser);
    mockPrismaService.user.update.mockResolvedValue(deactivatedUser);

    await expect(
      service.changeActivationStatus(2, { isActive: false }, currentUser),
    ).resolves.toEqual(deactivatedUser);

    expect(mockPrismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          isActive: false,
        },
      }),
    );
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditLogAction.DEACTIVATED,
        newValues: {
          isActive: false,
          passwordResetTokensInvalidated: true,
        },
      }),
      mockTransactionClient,
    );
    expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalled();
    expect(mockPasswordResetTokenModel.deleteMany).toHaveBeenCalledWith({
      where: { userId: storedUser.id },
    });
  });

  it('should reactivate a user without unlocking the account', async () => {
    const inactiveLockedUser = {
      ...storedUser,
      isActive: false,
      isLocked: true,
    };
    const reactivatedUser = {
      ...inactiveLockedUser,
      isActive: true,
    };
    mockPrismaService.user.findUnique.mockResolvedValue(inactiveLockedUser);
    mockPrismaService.user.update.mockResolvedValue(reactivatedUser);

    await expect(
      service.changeActivationStatus(2, { isActive: true }, currentUser),
    ).resolves.toEqual(reactivatedUser);
    expect(reactivatedUser.isLocked).toBe(true);
    expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mockPasswordResetTokenModel.deleteMany).not.toHaveBeenCalled();
  });

  it('should not let an admin deactivate their own account', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      ...storedUser,
      id: currentUser.userId,
      role: UserRole.ADMIN,
    });

    await expect(
      service.changeActivationStatus(
        currentUser.userId,
        { isActive: false },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(['ticket', 'asset', 'leaveRequest', 'user'] as const)(
    'does not mutate anything when %s handoff blocks deactivation',
    async (model) => {
      mockUserModel.findUnique.mockResolvedValue(storedUser);
      mockTransactionClient[model].count.mockResolvedValue(1);
      await expect(
        service.changeActivationStatus(2, { isActive: false }, currentUser),
      ).rejects.toThrow(ConflictException);
      expect(mockUserModel.update).not.toHaveBeenCalled();
      expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenModel.deleteMany).not.toHaveBeenCalled();
      expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    },
  );

  it.each(['update', 'deactivate'] as const)(
    'checks remaining usable admins for %s',
    async (operation) => {
      mockUserModel.findUnique.mockResolvedValue({
        ...storedUser,
        role: UserRole.ADMIN,
      });
      const call = () =>
        operation === 'update'
          ? service.update(2, { role: UserRole.EMPLOYEE }, currentUser)
          : service.changeActivationStatus(2, { isActive: false }, currentUser);
      await expect(call()).rejects.toThrow(
        'Cannot remove the last usable administrator',
      );
      expect(mockUserModel.update).not.toHaveBeenCalled();
      // The first count is remaining ADMINs; subsequent counts are reports.
      mockTransactionClient.user.count
        .mockResolvedValueOnce(1)
        .mockResolvedValue(0);
      mockUserModel.update.mockResolvedValue({
        ...storedUser,
        isActive: operation !== 'deactivate',
      });
      await expect(call()).resolves.toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    },
  );

  it.each(['update', 'deactivate', 'handoff'] as const)(
    'rejects a stale actor before %s writes',
    async (operation) => {
      mockTransactionClient.user.findUnique.mockResolvedValue({
        ...storedUser,
        role: UserRole.EMPLOYEE,
      });
      const promise =
        operation === 'update'
          ? service.update(2, { name: 'New name' }, currentUser)
          : operation === 'deactivate'
            ? service.changeActivationStatus(
                2,
                { isActive: false },
                currentUser,
              )
            : service.handoff(2, { replacementId: 3 }, currentUser);
      await expect(promise).rejects.toThrow(
        'An active administrator is required',
      );
      expect(mockUserModel.update).not.toHaveBeenCalled();
      expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
    },
  );

  it('does not let ADMIN remove their own role', async () => {
    await expect(
      service.update(1, { role: UserRole.EMPLOYEE }, currentUser),
    ).rejects.toThrow('Cannot remove your own ADMIN role');
    expect(mockUserModel.update).not.toHaveBeenCalled();
  });

  it('reads the target inside the transaction and keeps repeated deactivation idempotent', async () => {
    mockTransactionClient.user.findUnique
      .mockResolvedValueOnce({
        role: UserRole.ADMIN,
        isActive: true,
        isLocked: false,
      })
      .mockResolvedValueOnce({ ...storedUser, isActive: false });
    await service.changeActivationStatus(2, { isActive: false }, currentUser);
    expect(mockUserModel.findUnique).not.toHaveBeenCalled();
    expect(mockUserModel.update).not.toHaveBeenCalled();
    expect(mockAuditLogsService.create).not.toHaveBeenCalled();
  });

  it('blocks role changes that abandon active tickets', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      ...storedUser,
      role: UserRole.IT_STAFF,
    });
    mockTransactionClient.ticket.count.mockResolvedValue(1);
    await expect(
      service.update(2, { role: UserRole.EMPLOYEE }, currentUser),
    ).rejects.toThrow('Reassign active tickets');
    expect(mockUserModel.update).not.toHaveBeenCalled();
  });

  it('blocks reactivation under an unavailable manager', async () => {
    mockUserModel.findUnique.mockResolvedValue({
      ...storedUser,
      isActive: false,
    });
    mockTransactionClient.user.findUniqueOrThrow.mockResolvedValue({
      manager: { role: UserRole.MANAGER, isActive: false, isLocked: false },
    });
    await expect(
      service.changeActivationStatus(2, { isActive: true }, currentUser),
    ).rejects.toThrow('Reassign the unavailable manager');
    expect(mockUserModel.update).not.toHaveBeenCalled();
  });

  describe('handoff', () => {
    beforeEach(() => {
      mockUserModel.findUnique.mockImplementation(
        (args: { where: { id: number } }) =>
          Promise.resolve({
            ...storedUser,
            id: args.where.id,
            role: UserRole.MANAGER,
          }),
      );
      mockTransactionClient.user.updateMany.mockResolvedValue({ count: 2 });
      mockTransactionClient.leaveRequest.updateMany.mockResolvedValue({
        count: 1,
      });
    });

    it('transfers reports and only pending approvals together with audit', async () => {
      await expect(
        service.handoff(2, { replacementId: 3 }, currentUser),
      ).resolves.toEqual({
        userId: 2,
        replacementId: 3,
        reportsTransferred: 2,
        approvalsTransferred: 1,
      });
      expect(mockTransactionClient.user.updateMany).toHaveBeenCalledWith({
        where: { managerId: 2 },
        data: { managerId: 3 },
      });
      expect(
        mockTransactionClient.leaveRequest.updateMany,
      ).toHaveBeenCalledWith({
        where: { approverId: 2, status: 'PENDING' },
        data: { approverId: 3 },
      });
      expect(mockAuditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 1, entityId: 2 }),
        mockTransactionClient,
      );
      expect(mockUserModel.update).not.toHaveBeenCalled();
      expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
    });

    it('rejects self replacement', async () => {
      await expect(
        service.handoff(2, { replacementId: 2 }, currentUser),
      ).rejects.toThrow('Replacement must be a different user');
      expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      { role: UserRole.EMPLOYEE, isActive: true, isLocked: false },
      { role: UserRole.MANAGER, isActive: false, isLocked: false },
      { role: UserRole.MANAGER, isActive: true, isLocked: true },
    ])('rejects an ineligible replacement: %j', async (state) => {
      mockUserModel.findUnique.mockResolvedValue({
        ...storedUser,
        id: 3,
        ...state,
      });
      await expect(
        service.handoff(2, { replacementId: 3 }, currentUser),
      ).rejects.toThrow('Replacement must be an active');
      expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a reporting cycle', async () => {
      mockUserModel.findUnique.mockResolvedValue({
        ...storedUser,
        id: 3,
        role: UserRole.MANAGER,
        managerId: 2,
      });
      await expect(
        service.handoff(2, { replacementId: 3 }, currentUser),
      ).rejects.toThrow('reporting cycle');
      expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
    });

    it('rejects handing an approver their own pending leave request', async () => {
      mockTransactionClient.leaveRequest.count.mockResolvedValue(1);
      await expect(
        service.handoff(2, { replacementId: 3 }, currentUser),
      ).rejects.toThrow('cannot approve their own');
      expect(
        mockTransactionClient.leaveRequest.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('does not audit an empty handoff', async () => {
      mockTransactionClient.user.updateMany.mockResolvedValue({ count: 0 });
      mockTransactionClient.leaveRequest.updateMany.mockResolvedValue({
        count: 0,
      });
      await service.handoff(2, { replacementId: 3 }, currentUser);
      expect(mockAuditLogsService.create).not.toHaveBeenCalled();
    });

    it('reads minimal fields and does not re-read a recipient without a manager', async () => {
      await service.handoff(2, { replacementId: 3 }, currentUser);
      expect(mockTransactionClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        select: { id: true },
      });
      expect(mockTransactionClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        select: {
          id: true,
          role: true,
          isActive: true,
          isLocked: true,
          managerId: true,
        },
      });
      expect(
        mockTransactionClient.user.findUniqueOrThrow,
      ).not.toHaveBeenCalled();
    });

    it.each([2, 3])(
      'rejects missing user %s without writes',
      async (missingId) => {
        mockUserModel.findUnique.mockImplementation(
          (args: { where: { id: number } }) =>
            Promise.resolve(
              args.where.id === missingId
                ? null
                : { ...storedUser, id: args.where.id, role: UserRole.MANAGER },
            ),
        );
        await expect(
          service.handoff(2, { replacementId: 3 }, currentUser),
        ).rejects.toThrow(NotFoundException);
        expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
        expect(
          mockTransactionClient.leaveRequest.updateMany,
        ).not.toHaveBeenCalled();
        expect(mockAuditLogsService.create).not.toHaveBeenCalled();
      },
    );

    it.each([2, 3, 4])(
      'rejects a deeper cycle back to user %s',
      async (cycleId) => {
        mockUserModel.findUnique.mockResolvedValue({
          ...storedUser,
          id: 3,
          role: UserRole.MANAGER,
          managerId: 4,
        });
        mockTransactionClient.user.findUniqueOrThrow.mockResolvedValue({
          managerId: cycleId,
        });
        await expect(
          service.handoff(2, { replacementId: 3 }, currentUser),
        ).rejects.toThrow('reporting cycle');
        expect(mockTransactionClient.user.updateMany).not.toHaveBeenCalled();
      },
    );

    it('still walks a valid multi-level reporting chain', async () => {
      mockUserModel.findUnique.mockResolvedValue({
        ...storedUser,
        id: 3,
        role: UserRole.MANAGER,
        managerId: 4,
      });
      mockTransactionClient.user.findUniqueOrThrow
        .mockResolvedValueOnce({ managerId: 5 })
        .mockResolvedValueOnce({ managerId: null });
      await service.handoff(2, { replacementId: 3 }, currentUser);
      expect(mockTransactionClient.user.findUniqueOrThrow.mock.calls).toEqual([
        [{ where: { id: 4 }, select: { managerId: true } }],
        [{ where: { id: 5 }, select: { managerId: true } }],
      ]);
      expect(mockTransactionClient.user.updateMany).toHaveBeenCalledTimes(1);
    });

    it('propagates an audit transaction failure without retrying or returning success', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Expired', {
        code: 'P2028',
        clientVersion: '7',
      });
      mockAuditLogsService.create.mockRejectedValue(error);
      await expect(
        service.handoff(2, { replacementId: 3 }, currentUser),
      ).rejects.toBe(error);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockAuditLogsService.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockTransactionClient,
      );
    });
  });
});
