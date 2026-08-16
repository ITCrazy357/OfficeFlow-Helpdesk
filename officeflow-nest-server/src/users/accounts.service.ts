import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  type Prisma,
  UserRole,
  AuditLogAction,
  AuditLogEntity,
} from '@prisma/client';
import { type CurrentUserPayload } from '../common/decorators/current-user.decorator';

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
  ) {}

  private assertCanManageAccount(
    actor: CurrentUserPayload,
    target: Pick<AccountUser, 'id' | 'role'>,
    operation: 'lock' | 'unlock',
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
}
