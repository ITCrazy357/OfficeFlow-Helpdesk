import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditLogAction,
  AuditLogEntity,
  type Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserPasswordResetEvent } from '../notifications/events/user-password-reset.event';
import { PrismaService } from '../prisma/prisma.service';

import { ChangeMyPasswordDto } from './dto/change-my-password.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

const accountUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  isLocked: true,
  lockedAt: true,
  lockedById: true,
  unlockedAt: true,
  unlockedById: true,
  mustChangePassword: true,
  departmentId: true,
  createdAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

type AccountUser = Prisma.UserGetPayload<{
  select: typeof accountUserSelect;
}>;

const MANAGEABLE_TARGET_ROLES: UserRole[] = [
  UserRole.EMPLOYEE,
  UserRole.MANAGER,
  UserRole.IT_STAFF,
];

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private assertCanManageAccount(
    actor: CurrentUserPayload,
    target: Pick<AccountUser, 'id' | 'role'>,
    operation: 'lock' | 'unlock' | 'reset password',
  ) {
    if (actor.userId === target.id) {
      throw new ForbiddenException(`Cannot ${operation} your own account`);
    }

    const isAllowedActor =
      actor.role === UserRole.ADMIN || actor.role === UserRole.IT_STAFF;
    const isAllowedTarget = MANAGEABLE_TARGET_ROLES.includes(target.role);

    if (!isAllowedActor || !isAllowedTarget) {
      throw new ForbiddenException(
        `You do not have permission to ${operation} this user`,
      );
    }
  }

  private async resolveConcurrentTransition(
    transaction: Prisma.TransactionClient,
    actor: CurrentUserPayload,
    targetUserId: number,
    expectedState: boolean,
    operation: 'lock' | 'unlock',
  ) {
    const currentUser = await transaction.user.findUnique({
      where: { id: targetUserId },
      select: accountUserSelect,
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageAccount(actor, currentUser, operation);

    if (currentUser.isLocked === expectedState) {
      return currentUser;
    }

    throw new ConflictException(
      'Account lock state changed. Please retry the request',
    );
  }

  private async getUserOrThrow(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: accountUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async lockUser(actor: CurrentUserPayload, targetUserId: number) {
    const target = await this.getUserOrThrow(targetUserId);

    this.assertCanManageAccount(actor, target, 'lock');

    if (target.isLocked) {
      return target;
    }

    const lockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: {
          id: targetUserId,
          isLocked: false,
          role: {
            in: MANAGEABLE_TARGET_ROLES,
          },
        },

        data: {
          isLocked: true,
          lockedAt,
          lockedById: actor.userId,
          unlockedAt: null,
          unlockedById: null,
        },
      });

      if (result.count !== 1) {
        return this.resolveConcurrentTransition(
          transaction,
          actor,
          targetUserId,
          true,
          'lock',
        );
      }

      const updatedUser = await transaction.user.findUnique({
        where: { id: targetUserId },
        select: accountUserSelect,
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      await transaction.refreshToken.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
        },
        data: {
          revokedAt: lockedAt,
        },
      });

      await transaction.passwordResetToken.deleteMany({
        where: {
          userId: targetUserId,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.USER,
          entityId: updatedUser.id,
          action: AuditLogAction.UPDATE,
          description: `Locked user ${updatedUser.email}.`,
          oldValues: {
            isLocked: target.isLocked,
            lockedAt: target.lockedAt,
            lockedById: target.lockedById,
            unlockedAt: target.unlockedAt,
            unlockedById: target.unlockedById,
          },
          newValues: {
            isLocked: updatedUser.isLocked,
            lockedAt: updatedUser.lockedAt,
            lockedById: updatedUser.lockedById,
            unlockedAt: updatedUser.unlockedAt,
            unlockedById: updatedUser.unlockedById,
            sessionsRevoked: true,
            passwordResetTokensInvalidated: true,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        transaction,
      );

      return updatedUser;
    });
  }

  async unlockUser(actor: CurrentUserPayload, targetUserId: number) {
    const target = await this.getUserOrThrow(targetUserId);

    this.assertCanManageAccount(actor, target, 'unlock');

    if (!target.isLocked) {
      return target;
    }

    const unlockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: {
          id: targetUserId,
          isLocked: true,
          role: {
            in: MANAGEABLE_TARGET_ROLES,
          },
        },
        data: {
          isLocked: false,
          unlockedAt,
          unlockedById: actor.userId,
        },
      });

      if (result.count !== 1) {
        return this.resolveConcurrentTransition(
          transaction,
          actor,
          targetUserId,
          false,
          'unlock',
        );
      }

      const updatedUser = await transaction.user.findUnique({
        where: { id: targetUserId },
        select: accountUserSelect,
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      await this.auditLogsService.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.USER,
          entityId: updatedUser.id,
          action: AuditLogAction.UPDATE,
          description: `Unlocked user ${updatedUser.email}.`,
          oldValues: {
            isLocked: target.isLocked,
            lockedAt: target.lockedAt,
            lockedById: target.lockedById,
            unlockedAt: target.unlockedAt,
            unlockedById: target.unlockedById,
          },
          newValues: {
            isLocked: updatedUser.isLocked,
            lockedAt: updatedUser.lockedAt,
            lockedById: updatedUser.lockedById,
            unlockedAt: updatedUser.unlockedAt,
            unlockedById: updatedUser.unlockedById,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        transaction,
      );
      return updatedUser;
    });
  }

  async resetPassword(
    id: number,
    resetUserPasswordDto: ResetUserPasswordDto,
    currentUser: CurrentUserPayload,
  ) {
    const user = await this.getUserOrThrow(id);

    this.assertCanManageAccount(currentUser, user, 'reset password');

    const passwordHash = await bcrypt.hash(resetUserPasswordDto.password, 10);
    const now = new Date();

    const updatedUser = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: {
          id,
          role: {
            in: MANAGEABLE_TARGET_ROLES,
          },
        },
        data: {
          passwordHash,
          mustChangePassword: true,
        },
      });

      if (result.count !== 1) {
        const currentTarget = await transaction.user.findUnique({
          where: { id },
          select: accountUserSelect,
        });

        if (!currentTarget) {
          throw new NotFoundException('User not found');
        }

        this.assertCanManageAccount(
          currentUser,
          currentTarget,
          'reset password',
        );

        throw new ConflictException(
          'Account changed while resetting the password. Please retry',
        );
      }

      const updatedUser = await transaction.user.findUnique({
        where: { id },
        select: accountUserSelect,
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      await transaction.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await transaction.passwordResetToken.deleteMany({
        where: {
          userId: id,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.USER,
          entityId: user.id,
          action: AuditLogAction.UPDATE,
          description: `Reset password for user ${updatedUser.email}.`,
          oldValues: {
            mustChangePassword: user.mustChangePassword,
          },
          newValues: {
            mustChangePassword: updatedUser.mustChangePassword,
            sessionsRevoked: true,
            passwordResetTokensInvalidated: true,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return updatedUser;
    });

    this.eventEmitter.emit(
      'user.password-reset',
      new UserPasswordResetEvent(updatedUser.id),
    );

    return updatedUser;
  }

  async changeOwnPassword(dto: ChangeMyPasswordDto, actor: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: actor.userId,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        mustChangePassword: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password cannot be the same as the current password',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const changedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: {
          id: actor.userId,
          passwordHash: user.passwordHash,
        },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Password changed in another request. Please sign in again',
        );
      }

      await transaction.refreshToken.updateMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: changedAt,
        },
      });

      await transaction.passwordResetToken.deleteMany({
        where: {
          userId: actor.userId,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.USER,
          entityId: user.id,
          action: AuditLogAction.UPDATE,
          description: 'Changed own password.',
          oldValues: {
            mustChangePassword: user.mustChangePassword,
          },
          newValues: {
            mustChangePassword: false,
            sessionsRevoked: true,
            passwordResetTokensInvalidated: true,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        transaction,
      );

      return {
        passwordChanged: true,
        mustChangePassword: false,
      };
    });
  }
}
