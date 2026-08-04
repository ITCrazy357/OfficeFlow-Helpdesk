import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockBcryptHash = bcrypt.hash as unknown as jest.Mock<
  Promise<string>,
  [string, number]
>;

const mockBcryptCompare = bcrypt.compare as unknown as jest.Mock<
  Promise<boolean>,
  [string, string]
>;

type CreateUserArgs = {
  data: {
    name: string;
    email: string;
    passwordHash: string;
    departmentId?: number;
  };
  select: {
    id: boolean;
    name: boolean;
    email: boolean;
    role: boolean;
    isActive: boolean;
    departmentId: boolean;
    createdAt: boolean;
  };
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [CreateUserArgs]>(),
  },
  refreshToken: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
  },
  $transaction: jest.fn<
    Promise<unknown>,
    [
      (transaction: {
        refreshToken: {
          create: jest.Mock;
          updateMany: jest.Mock;
        };
      }) => Promise<unknown>,
    ]
  >(),
};

const mockJwtService = {
  sign: jest.fn<string, [unknown]>(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockPrismaService.refreshToken.create.mockResolvedValue({});
    mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback({ refreshToken: mockPrismaService.refreshToken }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'strong-password-123',
      departmentId: 1,
    };

    it('should register a new user successfully', async () => {
      const createdUser = {
        id: 1,
        name: registerDto.name,
        email: registerDto.email,
        role: UserRole.EMPLOYEE,
        isActive: true,
        departmentId: registerDto.departmentId,
        createdAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });

      expect(mockPrismaService.user.create).toHaveBeenCalledTimes(1);

      const createArgs = mockPrismaService.user.create.mock.calls[0][0];

      expect(createArgs).toEqual({
        data: {
          name: registerDto.name,
          email: registerDto.email,
          passwordHash: 'hashed-password',
          departmentId: registerDto.departmentId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          departmentId: true,
          createdAt: true,
        },
      });
      expect(mockBcryptHash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(result).toEqual(createdUser);
    });

    it('should throw BadRequestException when email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: '123456',
    };

    it('should login successfully and return an access token', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: loginDto.email,
        passwordHash: 'hashed-password',
        role: UserRole.EMPLOYEE,
        isActive: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockBcryptCompare.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        loginDto.password,
        user.passwordHash,
      );
      const createdSession = mockPrismaService.refreshToken.create.mock
        .calls[0][0] as {
        data: {
          id: string;
          expiresAt: Date;
        };
      };

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        sid: createdSession.data.id,
        role: user.role,
      });
      expect(result.accessToken).toBe('mock-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshTokenExpiresAt).toBe(createdSession.data.expiresAt);
      expect(result.user).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when account is inactive', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        email: loginDto.email,
        passwordHash: 'password-hash',
        role: UserRole.EMPLOYEE,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: loginDto.email,
        passwordHash: 'hashed-password',
        role: UserRole.EMPLOYEE,
        isActive: true,
      });
      mockBcryptCompare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockBcryptCompare).toHaveBeenCalledWith(
        loginDto.password,
        'hashed-password',
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const storedToken = {
      id: 'old-session-id',
      tokenHash: 'stored-hash',
      familyId: 'token-family-id',
      userId: 1,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      revokedAt: null,
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    };

    it('should rotate a valid refresh token', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('valid-refresh-token', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshTokenExpiresAt).toBe(storedToken.expiresAt);
      expect(result.refreshToken).not.toBe('valid-refresh-token');

      const updateArgs = mockPrismaService.refreshToken.updateMany.mock
        .calls[0][0] as {
        where: {
          id: string;
          usedAt: null;
          revokedAt: null;
        };
        data: {
          usedAt: Date;
          revokedAt: Date;
          replacedById: string;
        };
      };
      expect(updateArgs.where.id).toBe(storedToken.id);
      expect(updateArgs.where.usedAt).toBeNull();
      expect(updateArgs.where.revokedAt).toBeNull();
      expect(updateArgs.data.usedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.revokedAt).toBeInstanceOf(Date);
      expect(typeof updateArgs.data.replacedById).toBe('string');

      const createArgs = mockPrismaService.refreshToken.create.mock
        .calls[0][0] as {
        data: {
          id: string;
          tokenHash: string;
          familyId: string;
          userId: number;
          expiresAt: Date;
          ipAddress?: string;
          userAgent?: string;
        };
      };
      expect(typeof createArgs.data.id).toBe('string');
      expect(typeof createArgs.data.tokenHash).toBe('string');
      expect(createArgs.data.familyId).toBe(storedToken.familyId);
      expect(createArgs.data.userId).toBe(storedToken.userId);
      expect(createArgs.data.expiresAt).toBe(storedToken.expiresAt);
      expect(createArgs.data.ipAddress).toBe('127.0.0.1');
      expect(createArgs.data.userAgent).toBe('test-agent');
    });

    it('should revoke the token family when a used token is replayed', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        usedAt: new Date(),
      });

      await expect(service.refresh('replayed-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      const revokeArgs = mockPrismaService.refreshToken.updateMany.mock
        .calls[0][0] as {
        where: {
          familyId: string;
          revokedAt: null;
        };
        data: {
          revokedAt: Date;
        };
      };
      expect(revokeArgs).toEqual({
        where: {
          familyId: storedToken.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: revokeArgs.data.revokedAt,
        },
      });
      expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return the current user', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.EMPLOYEE,
        isActive: true,
        department: {
          id: 1,
          name: 'Engineering',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.getMe(user.id)).resolves.toEqual(user);
      expect(user).not.toHaveProperty('passwordHash');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });
  });
});
