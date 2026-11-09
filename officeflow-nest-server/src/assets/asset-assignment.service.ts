import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogAction, AuditLogEntity, AssetStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { OUTBOX_EVENT_TYPES } from '../contracts/events/outbox-events';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignAssetDto } from './dto/assign-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';

@Injectable()
export class AssetAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly outboxService: OutboxService,
  ) {}

  private async getAssetOrThrow(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async assign(
    id: number,
    assignAssetDto: AssignAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const result = await runSerializableTransaction(this.prisma, async (tx) => {
      const [asset, targetUser, actor] = await Promise.all([
        tx.asset.findUnique({
          where: { id },
        }),

        tx.user.findUnique({
          where: {
            id: assignAssetDto.userId,
          },
          select: {
            id: true,
            name: true,
            isActive: true,
            isLocked: true,
          },
        }),

        tx.user.findUnique({
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

      if (targetUser.isLocked) {
        throw new BadRequestException(
          'Cannot assign an asset to a locked user',
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

      await this.outboxService.enqueue(tx, {
        type: OUTBOX_EVENT_TYPES.ASSET_ASSIGNED,
        payload: {
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: asset.name,
          assignedToId: targetUser.id,
          assignedByName: actor?.name || 'IT staff',
        },
      });

      return {
        asset: updatedAsset,
        assignment,
      };
    });

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

      await this.outboxService.enqueue(tx, {
        type: OUTBOX_EVENT_TYPES.ASSET_RETURNED,
        payload: {
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: asset.name,
          previousAssignedToId,
          returnedByName: actor?.name || 'IT staff',
        },
      });

      return updatedAsset;
    });

    return result;
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
