import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  AssetStatus,
  type Prisma,
  UserRole,
} from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { GetAssetsQueryDto } from './dto/get-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { warrantyWindow } from './asset-care.util';
import { AssetAssignmentService } from './asset-assignment.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly assignment: AssetAssignmentService,
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
          supplierName: createAssetDto.supplierName,
          supplierContact: createAssetDto.supplierContact,
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
    if (query.warranty) {
      const { start, end } = warrantyWindow();
      where.warrantyUntil =
        query.warranty === 'EXPIRING' ? { gte: start, lt: end } : { lt: start };
      where.AND = [
        { status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] } },
      ];
    }

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

    if (Object.keys(updateAssetDto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

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
          supplierName: updateAssetDto.supplierName,
          supplierContact: updateAssetDto.supplierContact,
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
            supplierName: asset.supplierName,
            supplierContact: asset.supplierContact,
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
            supplierName: updatedAsset.supplierName,
            supplierContact: updatedAsset.supplierContact,
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

  assign(...args: Parameters<AssetAssignmentService['assign']>) {
    return this.assignment.assign(...args);
  }

  returnAsset(...args: Parameters<AssetAssignmentService['returnAsset']>) {
    return this.assignment.returnAsset(...args);
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

  getAssignmentHistory(id: number) {
    return this.assignment.getAssignmentHistory(id);
  }
}
