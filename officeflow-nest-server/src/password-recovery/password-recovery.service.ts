import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogAction, AuditLogEntity, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PasswordRecoveryCompletedEvent } from '../notifications/events/password-recovery-completed.event';
import { PasswordResetRequestedEvent } from '../notifications/events/password-reset-requested.event';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetForgottenPasswordDto } from './dto/reset-forgotten-password.dto';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60_000;
const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 5 * 60_000;
const GENERIC_RESPONSE_MIN_DURATION_MS = 250;
const MAX_ISSUE_ATTEMPTS = 2;
const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired password reset token';

function generatePasswordResetToken() {
  return randomBytes(32).toString('base64url');
}

function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async waitForGenericResponseFloor(startedAt: number) {
    const remaining =
      GENERIC_RESPONSE_MIN_DURATION_MS - (Date.now() - startedAt);

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  private async issuePasswordResetToken(
    userId: number,
    tokenHash: string,
    issuedAt: Date,
    expiresAt: Date,
    metadata: RequestMetadata,
  ) {
    for (let attempt = 1; attempt <= MAX_ISSUE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const existingToken =
              await transaction.passwordResetToken.findUnique({
                where: { userId },
                select: {
                  createdAt: true,
                  usedAt: true,
                },
              });

            const cooldownStartedAt = new Date(
              issuedAt.getTime() - PASSWORD_RESET_REQUEST_COOLDOWN_MS,
            );

            if (
              existingToken &&
              !existingToken.usedAt &&
              existingToken.createdAt > cooldownStartedAt
            ) {
              return false;
            }

            await transaction.passwordResetToken.upsert({
              where: { userId },
              create: {
                userId,
                tokenHash,
                expiresAt,
                createdAt: issuedAt,
              },
              update: {
                tokenHash,
                expiresAt,
                usedAt: null,
                createdAt: issuedAt,
              },
            });

            await this.auditLogsService.create(
              {
                actorId: null,
                entity: AuditLogEntity.USER,
                entityId: userId,
                action: AuditLogAction.UPDATE,
                description: 'Issued a self-service password reset token.',
                newValues: {
                  passwordResetRequested: true,
                  expiresAt: expiresAt.toISOString(),
                },
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
              },
              transaction,
            );

            return true;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error: unknown) {
        const isWriteConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isWriteConflict) {
          throw error;
        }

        if (attempt === MAX_ISSUE_ATTEMPTS) {
          return false;
        }
      }
    }

    return false;
  }

  async forgotPassword(dto: ForgotPasswordDto, metadata: RequestMetadata = {}) {
    const startedAt = Date.now();
    const rawToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(rawToken);
    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + PASSWORD_RESET_TOKEN_TTL_MS,
    );

    try {
      const email = dto.email.trim().toLowerCase();
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          isActive: true,
          isLocked: true,
        },
      });

      if (user?.isActive && !user.isLocked) {
        const issued = await this.issuePasswordResetToken(
          user.id,
          tokenHash,
          issuedAt,
          expiresAt,
          metadata,
        );

        if (issued) {
          this.eventEmitter.emit(
            'password-reset.requested',
            new PasswordResetRequestedEvent(user.id, rawToken, expiresAt),
          );
        }
      }

      return { accepted: true as const };
    } finally {
      await this.waitForGenericResponseFloor(startedAt);
    }
  }

  async resetPassword(
    dto: ResetForgottenPasswordDto,
    metadata: RequestMetadata = {},
  ) {
    const tokenHash = hashPasswordResetToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            passwordHash: true,
            isActive: true,
            isLocked: true,
            mustChangePassword: true,
          },
        },
      },
    });
    const checkedAt = new Date();

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= checkedAt ||
      !resetToken.user.isActive ||
      resetToken.user.isLocked
    ) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const reusesCurrentPassword = await bcrypt.compare(
      dto.newPassword,
      resetToken.user.passwordHash,
    );

    if (reusesCurrentPassword) {
      throw new BadRequestException(
        'New password cannot be the same as the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const resetAt = new Date();

    const result = await this.prisma.$transaction(async (transaction) => {
      const claimedToken = await transaction.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: resetAt },
        },
        data: {
          usedAt: resetAt,
        },
      });

      if (claimedToken.count !== 1) {
        throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
      }

      const updatedUser = await transaction.user.updateMany({
        where: {
          id: resetToken.userId,
          passwordHash: resetToken.user.passwordHash,
          isActive: true,
          isLocked: false,
        },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      if (updatedUser.count !== 1) {
        throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
      }

      await transaction.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: resetAt,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: null,
          entity: AuditLogEntity.USER,
          entityId: resetToken.userId,
          action: AuditLogAction.UPDATE,
          description: 'Reset password using a recovery token.',
          oldValues: {
            mustChangePassword: resetToken.user.mustChangePassword,
          },
          newValues: {
            mustChangePassword: false,
            sessionsRevoked: true,
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        transaction,
      );

      return {
        passwordReset: true as const,
      };
    });

    this.eventEmitter.emit(
      'password-recovery.completed',
      new PasswordRecoveryCompletedEvent(resetToken.userId),
    );

    return result;
  }
}
