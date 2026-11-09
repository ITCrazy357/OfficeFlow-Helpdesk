import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ResetForgottenPasswordDto } from '../password-recovery/dto/reset-forgotten-password.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { AccountService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../outbox/outbox.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from './users.service';
import { PasswordRecoveryService } from '../password-recovery/password-recovery.service';

describe('bcrypt password boundaries (real bcrypt)', () => {
  const cases = [
    ['ASCII', 'a'.repeat(72), 'a'.repeat(73)],
    ['Vietnamese', 'á'.repeat(36), 'á'.repeat(37)],
    ['emoji', '🔐'.repeat(18), '🔐'.repeat(19)],
  ];
  const dtos = (password: string) => [
    Object.assign(new CreateUserDto(), { password }),
    Object.assign(new ResetUserPasswordDto(), { password }),
    Object.assign(new ChangeMyPasswordDto(), { newPassword: password }),
    Object.assign(new ResetForgottenPasswordDto(), { newPassword: password }),
  ];

  it.each(cases)(
    'accepts 72 bytes and rejects longer new passwords: %s',
    async (_name, valid, invalid) => {
      for (const dto of dtos(valid)) {
        const errors = await validate(dto);
        expect(
          errors.filter((e) =>
            ['password', 'newPassword'].includes(e.property),
          ),
        ).toEqual([]);
      }
      for (const dto of dtos(invalid)) {
        const errors = await validate(dto);
        expect(
          errors.some((e) => ['password', 'newPassword'].includes(e.property)),
        ).toBe(true);
      }
    },
  );

  it('keeps legacy login and current password input compatible', async () => {
    const password = 'á'.repeat(40);
    expect(
      await validate(
        Object.assign(new LoginDto(), {
          email: 'fixture@test.invalid',
          password,
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        Object.assign(new ChangeMyPasswordDto(), {
          currentPassword: password,
          newPassword: 'independent-new-password',
        }),
      ),
    ).toEqual([]);
  });

  it('rejects excessive bytes at all four service entry points before accessing storage', async () => {
    const prisma = {} as PrismaService;
    const audit = {} as AuditLogsService;
    const outbox = {} as OutboxService;
    const events = new EventEmitter2();
    const accounts = new AccountService(prisma, audit, outbox);
    const actor = { userId: 1, role: UserRole.ADMIN };
    const password = 'á'.repeat(40);
    const calls = [
      () =>
        accounts.changeOwnPassword(
          { currentPassword: 'old-fixture-password', newPassword: password },
          actor,
        ),
      () => accounts.resetPassword(2, { password }, actor),
      () =>
        new UsersService(prisma, audit, events, outbox).create(
          {
            name: 'Fixture',
            email: 'fixture@test.invalid',
            password,
            role: UserRole.EMPLOYEE,
            departmentId: 1,
          },
          actor,
        ),
      () =>
        new PasswordRecoveryService(
          prisma,
          audit,
          events,
          outbox,
        ).resetPassword({ token: 'fixture-token', newPassword: password }),
    ];
    for (const call of calls)
      await expect(call()).rejects.toThrow(BadRequestException);
  });

  it('rejects a different string with the same bcrypt-effective legacy password', async () => {
    const prefix = 'á'.repeat(36);
    const legacyHash = await bcrypt.hash(prefix + '-legacy', 4);
    const transaction = jest.fn();
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, passwordHash: legacyHash }),
      },
      $transaction: transaction,
    };
    const service = new AccountService(
      prisma as unknown as PrismaService,
      {} as AuditLogsService,
      {} as OutboxService,
    );
    await expect(
      service.changeOwnPassword(
        { currentPassword: prefix + '-legacy', newPassword: prefix },
        { userId: 1, role: UserRole.EMPLOYEE },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
