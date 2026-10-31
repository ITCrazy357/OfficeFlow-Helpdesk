import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditLogsService } from '../../src/audit-logs/audit-logs.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { AccountService } from '../../src/users/accounts.service';
import { PasswordRecoveryService } from '../../src/password-recovery/password-recovery.service';

describe('Password recovery concurrency on disposable MySQL', () => {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
  );
  const audit = new AuditLogsService(prisma);
  const outbox = new OutboxService();
  beforeAll(async () => {
    await prisma.onModuleInit();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each(['locked', 'inactive', 'password_reset'] as const)(
    'does not revive a recovery request after the account is %s',
    async (state) => {
      const user = await prisma.user.create({
        data: {
          name: 'Recovery fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'initial-test-only-hash',
        },
      });
      const admin = await prisma.user.create({
        data: {
          name: 'Admin fixture',
          email: `${randomUUID()}@test.invalid`,
          passwordHash: 'test-only',
          role: 'ADMIN',
        },
      });
      let markPaused!: () => void;
      let resume!: () => void;
      const paused = new Promise<void>((resolve) => {
        markPaused = resolve;
      });
      const released = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const delayed = {
        user: prisma.user,
        $transaction: async (
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options: { isolationLevel: Prisma.TransactionIsolationLevel },
        ) => {
          markPaused();
          await released;
          return prisma.$transaction(work, options);
        },
      } as unknown as PrismaService;
      const events = new EventEmitter2();
      const requested = jest.fn();
      events.on('password-reset.requested', requested);
      const service = new PasswordRecoveryService(
        delayed,
        audit,
        events,
        outbox,
      );
      const outcome = service.forgotPassword({ email: user.email }).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        await paused;
        const accounts = new AccountService(prisma, audit, outbox);
        const actor = { userId: admin.id, role: admin.role };
        if (state === 'locked') await accounts.lockUser(actor, user.id);
        else if (state === 'password_reset')
          await accounts.resetPassword(
            user.id,
            { password: randomUUID() },
            actor,
          );
        else
          await prisma.user.update({
            where: { id: user.id },
            data: { isActive: false },
          });
      } finally {
        resume();
      }
      expect(await outcome).toEqual({ value: { accepted: true } });
      expect(
        await prisma.passwordResetToken.count({ where: { userId: user.id } }),
      ).toBe(0);
      expect(requested).not.toHaveBeenCalled();
      expect(
        await prisma.auditLog.count({
          where: {
            entity: 'USER',
            entityId: user.id,
            description: 'Issued a self-service password reset token.',
          },
        }),
      ).toBe(0);
    },
  );
});
