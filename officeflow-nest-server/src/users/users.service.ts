import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditLogAction,
  AuditLogEntity,
  LeaveStatus,
  type Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { HandoffUserDto } from './dto/handoff-user.dto';

import {
  assertActiveAdmin,
  assertAnotherUsableAdmin,
} from './user-lifecycle.policy';

import {
  assertNoPendingHandoff,
  assertRoleHandoff,
} from './user-handoff.policy';

const userSelect = {
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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly outboxService: OutboxService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: CurrentUserPayload) {
    const email = createUserDto.email.trim().toLowerCase();
    const [existedUser, department] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.department.findUnique({
        where: {
          id: createUserDto.departmentId,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (existedUser) {
      throw new ConflictException('Email already exists');
    }

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name: createUserDto.name.trim(),
          email,
          passwordHash,
          role: createUserDto.role,
          departmentId: createUserDto.departmentId,
        },
        select: userSelect,
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.USER,
          entityId: user.id,
          action: AuditLogAction.CREATE,
          description: `Created user ${user.email}.`,
          newValues: {
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
            isActive: user.isActive,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      await this.outboxService.enqueue(transaction, {
        type: OUTBOX_EVENT_TYPES.USER_CREATED,
        payload: { userId: user.id },
        deduplicationKey: `user-created:${user.id}`,
      });

      return user;
    });

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async getUserOrThrow(
    id: number,
    transaction: Prisma.TransactionClient,
  ) {
    const user = await transaction.user.findUnique({
      where: {
        id,
      },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureDepartmentExists(
    departmentId: number | null,
    transaction: Prisma.TransactionClient,
  ) {
    if (departmentId === null) {
      return;
    }

    const department = await transaction.department.findUnique({
      where: {
        id: departmentId,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUser: CurrentUserPayload,
  ) {
    const { updatedUser, departmentChanged } = await runSerializableTransaction(
      this.prisma,
      async (transaction) => {
        await assertActiveAdmin(transaction, currentUser.userId);
        const user = await this.getUserOrThrow(id, transaction);

        if (
          id === currentUser.userId &&
          updateUserDto.role &&
          updateUserDto.role !== UserRole.ADMIN
        ) {
          throw new BadRequestException('Cannot remove your own ADMIN role');
        }

        const data: Prisma.UserUncheckedUpdateInput = {};

        if (updateUserDto.name !== undefined) {
          data.name = updateUserDto.name.trim();
        }

        if (updateUserDto.email !== undefined) {
          data.email = updateUserDto.email.trim().toLowerCase();
        }

        if (updateUserDto.role !== undefined) {
          data.role = updateUserDto.role;
        }

        if (updateUserDto.departmentId !== undefined) {
          data.departmentId = updateUserDto.departmentId;
        }

        if (Object.keys(data).length === 0) {
          throw new BadRequestException('No user information to update');
        }

        if (data.email && data.email !== user.email) {
          const existedUser = await transaction.user.findFirst({
            where: {
              email: data.email as string,
              id: {
                not: id,
              },
            },
            select: {
              id: true,
            },
          });

          if (existedUser) {
            throw new ConflictException('Email already exists');
          }
        }

        if (updateUserDto.departmentId !== undefined) {
          await this.ensureDepartmentExists(
            updateUserDto.departmentId,
            transaction,
          );
        }

        const removesUsableAdmin =
          user.role === UserRole.ADMIN &&
          user.isActive &&
          !user.isLocked &&
          updateUserDto.role !== undefined &&
          updateUserDto.role !== UserRole.ADMIN;

        if (removesUsableAdmin) {
          await assertAnotherUsableAdmin(transaction, user.id);
        }

        if (
          updateUserDto.role !== undefined &&
          updateUserDto.role !== user.role
        ) {
          await assertRoleHandoff(transaction, user.id, updateUserDto.role);
        }

        const updatedUser = await transaction.user.update({
          where: {
            id,
          },
          data,
          select: userSelect,
        });

        const emailChanged = updatedUser.email !== user.email;

        if (emailChanged) {
          await transaction.passwordResetToken.deleteMany({
            where: {
              userId: id,
            },
          });
        }

        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.USER,
            entityId: user.id,
            action: AuditLogAction.UPDATE,
            description: `Updated user ${updatedUser.email}.`,
            oldValues: {
              name: user.name,
              email: user.email,
              role: user.role,
              departmentId: user.departmentId,
            },
            newValues: {
              name: updatedUser.name,
              email: updatedUser.email,
              role: updatedUser.role,
              departmentId: updatedUser.departmentId,
              passwordResetTokensInvalidated: emailChanged,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );

        return {
          updatedUser,
          departmentChanged: updatedUser.departmentId !== user.departmentId,
        };
      },
    );

    if (departmentChanged) {
      await this.eventEmitter.emitAsync(
        DASHBOARD_CACHE_INVALIDATE_EVENT,
        new DashboardCacheInvalidatedEvent(
          'USER_DEPARTMENT_CHANGED',
          updatedUser.id,
        ),
      );
    }

    return updatedUser;
  }

  async changeActivationStatus(
    id: number,
    changeUserStatusDto: ChangeUserStatusDto,
    currentUser: CurrentUserPayload,
  ) {
    return runSerializableTransaction(this.prisma, async (transaction) => {
      await assertActiveAdmin(transaction, currentUser.userId);
      const user = await this.getUserOrThrow(id, transaction);

      if (id === currentUser.userId && !changeUserStatusDto.isActive) {
        throw new BadRequestException('Cannot deactivate your own account');
      }

      if (user.isActive === changeUserStatusDto.isActive) {
        return user;
      }

      if (!changeUserStatusDto.isActive) {
        if (user.role === UserRole.ADMIN && !user.isLocked) {
          await assertAnotherUsableAdmin(transaction, user.id);
        }

        await assertNoPendingHandoff(transaction, user.id);
      } else {
        // Reactivation must not restore an active report under an unavailable manager.
        const relation = await transaction.user.findUniqueOrThrow({
          where: { id },
          select: {
            manager: { select: { role: true, isActive: true, isLocked: true } },
          },
        });
        if (
          relation.manager &&
          (!relation.manager.isActive ||
            relation.manager.isLocked ||
            (relation.manager.role !== UserRole.MANAGER &&
              relation.manager.role !== UserRole.ADMIN))
        ) {
          throw new ConflictException(
            'Reassign the unavailable manager before reactivating this user',
          );
        }
      }

      const updatedUser = await transaction.user.update({
        where: {
          id,
        },
        data: {
          isActive: changeUserStatusDto.isActive,
        },
        select: userSelect,
      });

      if (!updatedUser.isActive) {
        await transaction.refreshToken.updateMany({
          where: {
            userId: id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });

        await transaction.passwordResetToken.deleteMany({
          where: {
            userId: id,
          },
        });
      }

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.USER,
          entityId: user.id,
          action: updatedUser.isActive
            ? AuditLogAction.ACTIVATED
            : AuditLogAction.DEACTIVATED,
          description: `${updatedUser.isActive ? 'Activated' : 'Deactivated'} user ${updatedUser.email}.`,
          oldValues: {
            isActive: user.isActive,
          },
          newValues: {
            isActive: updatedUser.isActive,
            passwordResetTokensInvalidated: !updatedUser.isActive,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return updatedUser;
    });
  }

  async handoff(
    id: number, //người bị thay thế
    dto: HandoffUserDto,
    currentUser: CurrentUserPayload,
  ) {
    return runSerializableTransaction(this.prisma, async (transaction) => {
      await assertActiveAdmin(transaction, currentUser.userId);
      await this.getUserOrThrow(id, transaction);
      if (id === dto.replacementId) {
        throw new BadRequestException('Replacement must be a different user');
      }
      const replacement = await this.getUserOrThrow(
        //người thay thế
        dto.replacementId,
        transaction,
      );
      if (
        !replacement.isActive ||
        replacement.isLocked ||
        (replacement.role !== UserRole.ADMIN &&
          replacement.role !== UserRole.MANAGER)
      ) {
        throw new ConflictException(
          'Replacement must be an active, unlocked MANAGER or ADMIN',
        );
      }

      // Kiểm tra xem đổi manager của một user có tạo ra vòng lặp quản lý hay không.
      const visited = new Set<number>([id]);
      let ancestorId: number | null = replacement.id;
      while (ancestorId !== null) {
        if (visited.has(ancestorId))
          throw new ConflictException('Handoff would create a reporting cycle');
        visited.add(ancestorId);
        const ancestor: { managerId: number | null } =
          await transaction.user.findUniqueOrThrow({
            where: { id: ancestorId },
            select: { managerId: true },
          });
        ancestorId = ancestor.managerId;
      }

      const selfApproval = await transaction.leaveRequest.count({
        where: {
          approverId: id,
          requesterId: replacement.id,
          status: LeaveStatus.PENDING,
        },
      });
      if (selfApproval)
        throw new ConflictException(
          'Replacement cannot approve their own leave request',
        );

      const reports = await transaction.user.updateMany({
        where: { managerId: id },
        data: { managerId: replacement.id },
      });
      const approvals = await transaction.leaveRequest.updateMany({
        where: { approverId: id, status: LeaveStatus.PENDING },
        data: { approverId: replacement.id },
      });
      const result = {
        userId: id,
        replacementId: replacement.id,
        reportsTransferred: reports.count,
        approvalsTransferred: approvals.count,
      };
      if (reports.count || approvals.count) {
        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.USER,
            entityId: id,
            action: AuditLogAction.UPDATE,
            description:
              'Transferred reporting lines and pending leave approvals.',
            oldValues: { managerId: id, approverId: id },
            newValues: result,
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );
      }
      return result;
    });
  }
}
