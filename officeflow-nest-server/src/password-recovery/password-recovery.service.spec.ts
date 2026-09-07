import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordRecoveryService } from './password-recovery.service';

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

const mockPasswordResetTokenModel = {
  findUnique: jest.fn<Promise<unknown>, [unknown]>(),
  upsert: jest.fn<Promise<unknown>, [unknown]>(),
  updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockRefreshTokenModel = {
  updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
};

const mockTransactionClient = {
  user: mockUserModel,
  passwordResetToken: mockPasswordResetTokenModel,
  refreshToken: mockRefreshTokenModel,
};

const mockPrismaService = {
  user: mockUserModel,
  passwordResetToken: mockPasswordResetTokenModel,
  $transaction: jest.fn<
    Promise<unknown>,
    [(transaction: typeof mockTransactionClient) => Promise<unknown>, unknown?]
  >(),
};

const mockAuditLogsService = {
  create: jest.fn<Promise<unknown>, [unknown, unknown]>(),
};

const mockEventEmitter = {
  emit: jest.fn<boolean, [string, unknown]>(),
};

const mockOutboxService = {
  enqueue: jest.fn().mockResolvedValue({ id: 'outbox-event-id' }),
};

const activeUser = {
  id: 7,
  isActive: true,
  isLocked: false,
};

const rawToken = 'a'.repeat(43);
const storedResetToken = {
  id: 15,
  userId: activeUser.id,
  tokenHash: createHash('sha256').update(rawToken).digest('hex'),
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  user: {
    passwordHash: 'current-password-hash',
    isActive: true,
    isLocked: false,
    mustChangePassword: false,
  },
};

describe('PasswordRecoveryService', () => {
  let service: PasswordRecoveryService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    mockPasswordResetTokenModel.findUnique.mockResolvedValue(null);
    mockPasswordResetTokenModel.upsert.mockResolvedValue({});
    mockPasswordResetTokenModel.updateMany.mockResolvedValue({ count: 1 });
    mockUserModel.updateMany.mockResolvedValue({ count: 1 });
    mockRefreshTokenModel.updateMany.mockResolvedValue({ count: 1 });
    mockAuditLogsService.create.mockResolvedValue({});
    mockBcryptCompare.mockResolvedValue(false);
    mockBcryptHash.mockResolvedValue('new-password-hash');
    mockPrismaService.$transaction.mockImplementation((callback) =>
      callback(mockTransactionClient),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
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

    service = module.get(PasswordRecoveryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function resolveForgotPassword(email: string) {
    const resultPromise = service.forgotPassword(
      { email },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );

    await jest.runAllTimersAsync();

    return resultPromise;
  }

  it('returns the same generic result without issuing a token for an unknown email', async () => {
    mockUserModel.findUnique.mockResolvedValue(null);

    await expect(
      resolveForgotPassword(' Missing@Example.com '),
    ).resolves.toEqual({ accepted: true });
    expect(mockUserModel.findUnique).toHaveBeenCalledWith({
      where: { email: 'missing@example.com' },
      select: {
        id: true,
        isActive: true,
        isLocked: true,
      },
    });
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it.each([
    { isActive: false, isLocked: false },
    { isActive: true, isLocked: true },
  ])(
    'does not issue a token when account policy rejects the user',
    async (policy) => {
      mockUserModel.findUnique.mockResolvedValue({ id: 7, ...policy });

      await expect(resolveForgotPassword('user@example.com')).resolves.toEqual({
        accepted: true,
      });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    },
  );

  it('stores only a SHA-256 token hash and emits the raw token after commit', async () => {
    mockUserModel.findUnique.mockResolvedValue(activeUser);

    await expect(resolveForgotPassword('USER@example.com')).resolves.toEqual({
      accepted: true,
    });

    const upsertArgs = mockPasswordResetTokenModel.upsert.mock.calls[0][0] as {
      create: { tokenHash: string; expiresAt: Date };
    };
    const emittedEvent = mockEventEmitter.emit.mock.calls[0]?.[1] as {
      rawToken: string;
      expiresAt: Date;
    };

    expect(emittedEvent.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(upsertArgs.create.tokenHash).toBe(
      createHash('sha256').update(emittedEvent.rawToken).digest('hex'),
    );
    expect(upsertArgs.create.tokenHash).not.toBe(emittedEvent.rawToken);
    expect(upsertArgs.create.expiresAt.getTime()).toBe(
      emittedEvent.expiresAt.getTime(),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'password-reset.requested',
      expect.objectContaining({ userId: activeUser.id }),
    );
    expect(
      JSON.stringify(mockAuditLogsService.create.mock.calls),
    ).not.toContain(emittedEvent.rawToken);
  });

  it('suppresses duplicate requests during the per-account cooldown', async () => {
    mockUserModel.findUnique.mockResolvedValue(activeUser);
    mockPasswordResetTokenModel.findUnique.mockResolvedValue({
      createdAt: new Date(),
      usedAt: null,
    });

    await expect(resolveForgotPassword('user@example.com')).resolves.toEqual({
      accepted: true,
    });
    expect(mockPasswordResetTokenModel.upsert).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('retries a serializable write conflict before issuing the token', async () => {
    const writeConflict = new Prisma.PrismaClientKnownRequestError(
      'Write conflict',
      {
        code: 'P2034',
        clientVersion: '7.9.1',
      },
    );
    mockUserModel.findUnique.mockResolvedValue(activeUser);
    mockPrismaService.$transaction
      .mockRejectedValueOnce(writeConflict)
      .mockImplementationOnce((callback) => callback(mockTransactionClient));

    await expect(resolveForgotPassword('user@example.com')).resolves.toEqual({
      accepted: true,
    });

    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('resets the password once, revokes sessions, and writes a secret-free audit log', async () => {
    mockPasswordResetTokenModel.findUnique.mockResolvedValue(storedResetToken);

    await expect(
      service.resetPassword(
        { token: rawToken, newPassword: 'new-secure-password-456' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
      ),
    ).resolves.toEqual({ passwordReset: true });

    expect(mockBcryptCompare).toHaveBeenCalledWith(
      'new-secure-password-456',
      storedResetToken.user.passwordHash,
    );
    expect(mockPasswordResetTokenModel.updateMany).toHaveBeenCalledWith({
      where: {
        id: storedResetToken.id,
        tokenHash: storedResetToken.tokenHash,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) as Date },
      },
      data: {
        usedAt: expect.any(Date) as Date,
      },
    });
    expect(mockUserModel.updateMany).toHaveBeenCalledWith({
      where: {
        id: storedResetToken.userId,
        passwordHash: storedResetToken.user.passwordHash,
        isActive: true,
        isLocked: false,
      },
      data: {
        passwordHash: 'new-password-hash',
        mustChangePassword: false,
      },
    });
    expect(mockRefreshTokenModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: storedResetToken.userId, revokedAt: null },
      }),
    );
    expect(mockOutboxService.enqueue).toHaveBeenCalledWith(
      mockTransactionClient,
      expect.objectContaining({
        type: 'password-recovery.completed',
        payload: { userId: storedResetToken.userId },
      }),
    );
    const auditCalls = JSON.stringify(mockAuditLogsService.create.mock.calls);
    expect(auditCalls).not.toContain(rawToken);
    expect(auditCalls).not.toContain('new-secure-password-456');
    expect(auditCalls).not.toContain('new-password-hash');
  });

  it('enqueues separate resets when the same token row is reused', async () => {
    const createEvent = jest.fn().mockResolvedValue({ id: 'event' });
    const outbox = new OutboxService();
    mockOutboxService.enqueue.mockImplementation(
      (_client: unknown, params: Parameters<OutboxService['enqueue']>[1]) =>
        outbox.enqueue(
          { outboxEvent: { create: createEvent } } as unknown as Pick<
            Prisma.TransactionClient,
            'outboxEvent'
          >,
          params,
        ),
    );
    for (const token of [rawToken, 'b'.repeat(43)]) {
      mockPasswordResetTokenModel.findUnique.mockResolvedValue({
        ...storedResetToken,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      });
      await expect(
        service.resetPassword({
          token,
          newPassword: 'new-secure-password-456',
        }),
      ).resolves.toEqual({ passwordReset: true });
    }
    const args = createEvent.mock.calls.map(
      ([arg]) => arg as Prisma.OutboxEventCreateArgs,
    );
    expect(args).toHaveLength(2);
    expect(args[0].data.deduplicationKey).not.toBe(
      args[1].data.deduplicationKey,
    );
    expect(JSON.stringify(args)).not.toContain(rawToken);
  });

  it.each([
    null,
    { ...storedResetToken, usedAt: new Date() },
    { ...storedResetToken, expiresAt: new Date(Date.now() - 1) },
    {
      ...storedResetToken,
      user: { ...storedResetToken.user, isActive: false },
    },
    {
      ...storedResetToken,
      user: { ...storedResetToken.user, isLocked: true },
    },
  ])('rejects an invalid token with the same error', async (tokenRecord) => {
    mockPasswordResetTokenModel.findUnique.mockResolvedValue(tokenRecord);

    await expect(
      service.resetPassword({
        token: rawToken,
        newPassword: 'new-secure-password-456',
      }),
    ).rejects.toThrow('Invalid or expired password reset token');
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reuse of the current password', async () => {
    mockPasswordResetTokenModel.findUnique.mockResolvedValue(storedResetToken);
    mockBcryptCompare.mockResolvedValue(true);

    await expect(
      service.resetPassword({
        token: rawToken,
        newPassword: 'current-password-value',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockBcryptHash).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a token claimed by a concurrent request', async () => {
    mockPasswordResetTokenModel.findUnique.mockResolvedValue(storedResetToken);
    mockPasswordResetTokenModel.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.resetPassword({
        token: rawToken,
        newPassword: 'new-secure-password-456',
      }),
    ).rejects.toThrow('Invalid or expired password reset token');
    expect(mockUserModel.updateMany).not.toHaveBeenCalled();
    expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
  });
});
