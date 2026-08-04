import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogAction, AuditLogEntity, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
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

const mockTransactionClient = {
  user: mockUserModel,
  refreshToken: mockRefreshTokenModel,
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

  it('should revoke sessions when an account is locked', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(storedUser);
    mockPrismaService.user.update.mockResolvedValue({
      ...storedUser,
      isActive: false,
    });

    await service.changeStatus(2, { isActive: false }, currentUser);

    const revokeArgs = mockPrismaService.refreshToken.updateMany.mock
      .calls[0][0] as {
      where: {
        userId: 2;
        revokedAt: null;
      };
      data: {
        revokedAt: Date;
      };
    };

    expect(revokeArgs).toEqual({
      where: {
        userId: 2,
        revokedAt: null,
      },
      data: {
        revokedAt: revokeArgs.data.revokedAt,
      },
    });
    expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditLogAction.DEACTIVATED,
      }),
      mockTransactionClient,
    );
  });

  it('should not let an admin lock their own account', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue({
      ...storedUser,
      id: currentUser.userId,
      role: UserRole.ADMIN,
    });

    await expect(
      service.changeStatus(
        currentUser.userId,
        { isActive: false },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reset a password without writing it to the audit log', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(storedUser);
    mockPrismaService.user.update.mockResolvedValue(storedUser);

    await service.resetPassword(
      storedUser.id,
      { password: 'new-strong-password-123' },
      currentUser,
    );

    expect(mockPrismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          passwordHash: 'hashed-password',
        },
      }),
    );
    expect(mockAuditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        newValues: {
          sessionsRevoked: true,
        },
      }),
      mockTransactionClient,
    );
    expect(
      JSON.stringify(mockAuditLogsService.create.mock.calls),
    ).not.toContain('new-strong-password-123');
    expect(
      JSON.stringify(mockAuditLogsService.create.mock.calls),
    ).not.toContain('hashed-password');
  });
});
