import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  type Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
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

    return this.prisma.$transaction(async (transaction) => {
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

      return user;
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUser: CurrentUserPayload,
  ) {
    const user = await this.getUserOrThrow(id);

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
      const existedUser = await this.prisma.user.findFirst({
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
      await this.ensureDepartmentExists(updateUserDto.departmentId);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: {
          id,
        },
        data,
        select: userSelect,
      });

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
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return updatedUser;
    });
  }

  async changeStatus(
    id: number,
    changeUserStatusDto: ChangeUserStatusDto,
    currentUser: CurrentUserPayload,
  ) {
    const user = await this.getUserOrThrow(id);

    if (id === currentUser.userId && !changeUserStatusDto.isActive) {
      throw new BadRequestException('Cannot lock your own account');
    }

    if (user.isActive === changeUserStatusDto.isActive) {
      return user;
    }

    return this.prisma.$transaction(async (transaction) => {
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
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
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
    const passwordHash = await bcrypt.hash(resetUserPasswordDto.password, 10);

    return this.prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: {
          id,
        },
        data: {
          passwordHash,
        },
        select: userSelect,
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.USER,
          entityId: user.id,
          action: AuditLogAction.UPDATE,
          description: `Reset password for user ${updatedUser.email}.`,
          newValues: {
            sessionsRevoked: true,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return updatedUser;
    });
  }

  private async getUserOrThrow(id: number) {
    const user = await this.prisma.user.findUnique({
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

  private async ensureDepartmentExists(departmentId: number | null) {
    if (departmentId === null) {
      return;
    }

    const department = await this.prisma.department.findUnique({
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
}
