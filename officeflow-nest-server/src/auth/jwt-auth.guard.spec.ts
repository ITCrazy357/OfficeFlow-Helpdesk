import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const mockJwtService = {
  verify: jest.fn(),
};

const mockPrismaService = {
  refreshToken: {
    findUnique: jest.fn(),
  },
};

function createContext() {
  const request = {
    headers: {
      authorization: 'Bearer access-token',
      'user-agent': 'test-agent',
    },
    ip: '127.0.0.1',
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    mockJwtService.verify.mockReturnValue({
      sub: 1,
      sid: 'session-id',
      role: UserRole.IT_STAFF,
    });
  });

  it('allows an active unlocked session and attaches the current database role', async () => {
    const { context, request } = createContext();
    mockPrismaService.refreshToken.findUnique.mockResolvedValue({
      userId: 1,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: UserRole.ADMIN,
        isActive: true,
        isLocked: false,
      },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      userId: 1,
      role: UserRole.ADMIN,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  it('rejects an otherwise valid session when the account is locked', async () => {
    const { context } = createContext();
    mockPrismaService.refreshToken.findUnique.mockResolvedValue({
      userId: 1,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: UserRole.IT_STAFF,
        isActive: true,
        isLocked: true,
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
