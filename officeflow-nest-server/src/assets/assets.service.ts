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
  AssetStatus,
  type Prisma,
  UserRole,
} from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AssetAssignedEvent } from '../notifications/events/asset-assigned.event';
import { AssetReturnedEvent } from '../notifications/events/asset-returned.event';
import { PrismaService } from '../prisma/prisma.service';

import { AssignAssetDto } from './dto/assign-asset.dto';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { GetAssetsQueryDto } from './dto/get-assets-query.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private canManageAssets(currentUser: CurrentUserPayload) {
    return (
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.IT_STAFF
    );
  }

  private async buildTicketScope(
    currentUser: CurrentUserPayload,
  ): Promise<Prisma.TicketWhereInput | undefined> {
    if (this.canManageAssets(currentUser)) {
      return undefined;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: {
          id: currentUser.userId,
        },
        select: {
          departmentId: true,
        },
      });

      if (manager?.departmentId) {
        return {
          createdBy: {
            departmentId: manager.departmentId,
          },
        };
      }
    }

    return {
      createdById: currentUser.userId,
    };
  }

  private async getAssetOrThrow(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async create(
    createAssetDto: CreateAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const assetTagExists = await this.prisma.asset.findUnique({
      where: {
        assetTag: createAssetDto.assetTag,
      },
      select: {
        id: true,
      },
    });

    if (assetTagExists) {
      throw new ConflictException('Asset tag already exists');
    }

    if (createAssetDto.serialNumber) {
      const serialNumberExists = await this.prisma.asset.findUnique({
        where: {
          serialNumber: createAssetDto.serialNumber,
        },
        select: {
          id: true,
        },
      });

      if (serialNumberExists) {
        throw new ConflictException('Serial number already exists');
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.create({
        data: {
          assetTag: createAssetDto.assetTag,
          name: createAssetDto.name,
          type: createAssetDto.type,
          brand: createAssetDto.brand,
          model: createAssetDto.model,
          serialNumber: createAssetDto.serialNumber,
          purchaseDate: createAssetDto.purchaseDate
            ? new Date(createAssetDto.purchaseDate)
            : undefined,
          warrantyUntil: createAssetDto.warrantyUntil
            ? new Date(createAssetDto.warrantyUntil)
            : undefined,
          notes: createAssetDto.notes,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.ASSET,
          entityId: asset.id,
          action: AuditLogAction.CREATE,
          description: `Created asset ${asset.assetTag}.`,
          newValues: {
            assetTag: asset.assetTag,
            name: asset.name,
            type: asset.type,
            status: asset.status,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return asset;
    });
  }

  async findAll(query: GetAssetsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();

      where.OR = [
        { assetTag: { contains: keyword } },
        { name: { contains: keyword } },
        { brand: { contains: keyword } },
        { model: { contains: keyword } },
        { serialNumber: { contains: keyword } },
      ];
    }

    const [assets, totalItems] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              tickets: true,
              assignments: true,
            },
          },
        },
      }),

      this.prisma.asset.count({ where }),
    ]);

    return {
      items: assets,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findMine(userId: number) {
    return this.prisma.asset.findMany({
      where: {
        assignedToId: userId,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    const ticketScope = await this.buildTicketScope(currentUser);
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        tickets: {
          where: ticketScope,
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (
      !this.canManageAssets(currentUser) &&
      asset.assignedToId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this asset',
      );
    }

    return asset;
  }

  async update(
    id: number,
    updateAssetDto: UpdateAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const asset = await this.getAssetOrThrow(id);

    if (updateAssetDto.assetTag) {
      const duplicate = await this.prisma.asset.findFirst({
        where: {
          assetTag: updateAssetDto.assetTag,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Asset tag already exists');
      }
    }

    if (updateAssetDto.serialNumber) {
      const duplicate = await this.prisma.asset.findFirst({
        where: {
          serialNumber: updateAssetDto.serialNumber,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Serial number already exists');
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedAsset = await transaction.asset.update({
        where: { id },
        data: {
          assetTag: updateAssetDto.assetTag,
          name: updateAssetDto.name,
          type: updateAssetDto.type,
          brand: updateAssetDto.brand,
          model: updateAssetDto.model,
          serialNumber: updateAssetDto.serialNumber,
          purchaseDate: updateAssetDto.purchaseDate
            ? new Date(updateAssetDto.purchaseDate)
            : undefined,
          warrantyUntil: updateAssetDto.warrantyUntil
            ? new Date(updateAssetDto.warrantyUntil)
            : undefined,
          notes: updateAssetDto.notes,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.ASSET,
          entityId: asset.id,
          action: AuditLogAction.UPDATE,
          description: `Updated asset ${asset.assetTag}.`,
          oldValues: {
            assetTag: asset.assetTag,
            name: asset.name,
            type: asset.type,
            brand: asset.brand,
            model: asset.model,
            serialNumber: asset.serialNumber,
            purchaseDate: asset.purchaseDate?.toISOString() ?? null,
            warrantyUntil: asset.warrantyUntil?.toISOString() ?? null,
            notes: asset.notes,
          },
          newValues: {
            assetTag: updatedAsset.assetTag,
            name: updatedAsset.name,
            type: updatedAsset.type,
            brand: updatedAsset.brand,
            model: updatedAsset.model,
            serialNumber: updatedAsset.serialNumber,
            purchaseDate: updatedAsset.purchaseDate?.toISOString() ?? null,
            warrantyUntil: updatedAsset.warrantyUntil?.toISOString() ?? null,
            notes: updatedAsset.notes,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      return updatedAsset;
    });
  }

  async assign(
    id: number,
    assignAssetDto: AssignAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const [asset, targetUser, actor] = await Promise.all([
      this.prisma.asset.findUnique({
        where: { id },
      }),

      this.prisma.user.findUnique({
        where: {
          id: assignAssetDto.userId,
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      }),

      this.prisma.user.findUnique({
        where: {
          id: currentUser.userId,
        },
        select: {
          name: true,
        },
      }),
    ]);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!targetUser.isActive) {
      throw new BadRequestException(
        'Cannot assign an asset to an inactive user',
      );
    }

    if (asset.assignedToId) {
      throw new BadRequestException(
        'Asset is already assigned. Return it before assigning again',
      );
    }

    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        `Asset with status ${asset.status} cannot be assigned`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.asset.updateMany({
        where: {
          id: asset.id,
          status: AssetStatus.AVAILABLE,
          assignedToId: null,
        },
        data: {
          status: AssetStatus.ASSIGNED,
          assignedToId: targetUser.id,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Asset is no longer available for assignment',
        );
      }

      const updatedAsset = await tx.asset.findUnique({
        where: {
          id: asset.id,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!updatedAsset) {
        throw new NotFoundException('Asset not found');
      }

      const assignment = await tx.assetAssignment.create({
        data: {
          assetId: asset.id,
          assignedToId: targetUser.id,
          assignedById: currentUser.userId,
        },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.ASSET,
          entityId: asset.id,
          action: AuditLogAction.ASSIGNED,
          description:
            `${actor?.name || 'IT staff'} assigned ` +
            `${asset.assetTag} to ${targetUser.name}.`,
          oldValues: {
            status: asset.status,
            assignedToId: asset.assignedToId,
          },
          newValues: {
            status: AssetStatus.ASSIGNED,
            assignedToId: targetUser.id,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        tx,
      );

      return {
        asset: updatedAsset,
        assignment,
      };
    });

    this.eventEmitter.emit(
      'asset.assigned',
      new AssetAssignedEvent(
        result.asset.id,
        result.asset.assetTag,
        result.asset.name,
        targetUser.id,
        actor?.name || 'IT staff',
      ),
    );

    return result;
  }

  async returnAsset(
    id: number,
    returnAssetDto: ReturnAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const [asset, actor] = await Promise.all([
      this.prisma.asset.findUnique({
        where: { id },
      }),

      this.prisma.user.findUnique({
        where: {
          id: currentUser.userId,
        },
        select: {
          name: true,
        },
      }),
    ]);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    if (asset.status !== AssetStatus.ASSIGNED || !asset.assignedToId) {
      throw new BadRequestException('Asset is not currently assigned');
    }

    const previousAssignedToId = asset.assignedToId;

    const result = await this.prisma.$transaction(async (tx) => {
      const openAssignment = await tx.assetAssignment.findFirst({
        where: {
          assetId: asset.id,
          returnedAt: null,
        },
        orderBy: {
          assignedAt: 'desc',
        },
      });

      if (!openAssignment) {
        throw new BadRequestException(
          'Open asset assignment history was not found',
        );
      }

      const assetUpdateResult = await tx.asset.updateMany({
        where: {
          id: asset.id,
          status: AssetStatus.ASSIGNED,
          assignedToId: previousAssignedToId,
        },
        data: {
          status: AssetStatus.AVAILABLE,
          assignedToId: null,
        },
      });

      if (assetUpdateResult.count === 0) {
        throw new BadRequestException('Asset assignment has changed');
      }

      const assignmentUpdateResult = await tx.assetAssignment.updateMany({
        where: {
          id: openAssignment.id,
          returnedAt: null,
        },
        data: {
          returnedAt: new Date(),
          returnNotes: returnAssetDto.notes,
        },
      });

      if (assignmentUpdateResult.count === 0) {
        throw new BadRequestException('Asset assignment has changed');
      }

      const updatedAsset = await tx.asset.findUnique({
        where: {
          id: asset.id,
        },
      });

      if (!updatedAsset) {
        throw new NotFoundException('Asset not found');
      }

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.ASSET,
          entityId: asset.id,
          action: AuditLogAction.RETURNED,
          description: `Returned asset ${asset.assetTag}.`,
          oldValues: {
            status: asset.status,
            assignedToId: previousAssignedToId,
          },
          newValues: {
            status: AssetStatus.AVAILABLE,
            assignedToId: null,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        tx,
      );

      return updatedAsset;
    });

    this.eventEmitter.emit(
      'asset.returned',
      new AssetReturnedEvent(
        asset.id,
        asset.assetTag,
        asset.name,
        previousAssignedToId,
        actor?.name || 'IT staff',
      ),
    );

    return result;
  }

  async changeStatus(
    id: number,
    changeAssetStatusDto: ChangeAssetStatusDto,
    currentUser: CurrentUserPayload,
  ) {
    const asset = await this.getAssetOrThrow(id);

    if (asset.assignedToId || asset.status === AssetStatus.ASSIGNED) {
      throw new BadRequestException(
        'Return the asset before changing its status',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.asset.updateMany({
        where: {
          id,
          status: {
            not: AssetStatus.ASSIGNED,
          },
          assignedToId: null,
        },
        data: {
          status: changeAssetStatusDto.status,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Return the asset before changing its status',
        );
      }

      const updatedAsset = await tx.asset.findUnique({
        where: { id },
      });

      if (!updatedAsset) {
        throw new NotFoundException('Asset not found');
      }

      if (asset.status !== updatedAsset.status) {
        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.ASSET,
            entityId: asset.id,
            action: AuditLogAction.STATUS_CHANGED,
            description: `Changed status of asset ${asset.assetTag}.`,
            oldValues: {
              status: asset.status,
            },
            newValues: {
              status: updatedAsset.status,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          tx,
        );
      }

      return updatedAsset;
    });
  }

  async getAssignmentHistory(id: number) {
    await this.getAssetOrThrow(id);

    return this.prisma.assetAssignment.findMany({
      where: {
        assetId: id,
      },
      orderBy: {
        assignedAt: 'desc',
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
