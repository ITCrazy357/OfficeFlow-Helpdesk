import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogAction, AuditLogEntity, UserRole } from '@prisma/client';
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
  user: mockUserModel,
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
});
