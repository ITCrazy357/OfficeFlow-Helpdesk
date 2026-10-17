import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetMaintenanceStatus,
  AssetStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  assetCareDates,
  parseAssetCareDate,
  WARRANTY_REMINDER_DAYS,
  warrantyWindow,
} from './asset-care.util';
import {
  CompleteMaintenanceDto,
  CreateMaintenanceDto,
  MaintenanceQueryDto,
  MaintenanceVersionDto,
  UpdateMaintenanceDto,
} from './dto/asset-maintenance.dto';

@Injectable()
export class AssetMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  private assertManager(actor: CurrentUserPayload) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.IT_STAFF)
      throw new ForbiddenException('Forbidden');
  }

  private async requireAsset(
    assetId: number,
    db: Pick<Prisma.TransactionClient, 'asset'> = this.prisma,
  ) {
    const asset = await db.asset.findUnique({
      where: { id: assetId },
      select: { id: true, status: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async list(
    assetId: number,
    query: MaintenanceQueryDto,
    actor: CurrentUserPayload,
  ) {
    this.assertManager(actor);
    await this.requireAsset(assetId);
    const page = query.page ?? 1,
      limit = query.limit ?? 10;
    const where = { assetId, status: query.status };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.assetMaintenance.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ scheduledFor: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.assetMaintenance.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async create(
    assetId: number,
    dto: CreateMaintenanceDto,
    actor: CurrentUserPayload,
  ) {
    this.assertManager(actor);
    const scheduledFor = parseAssetCareDate(dto.scheduledFor);
    if (dto.title.trim().length < 2)
      throw new BadRequestException(
        'Title must contain at least two characters',
      );
    return runSerializableTransaction(this.prisma, async (tx) => {
      const asset = await this.requireAsset(assetId, tx);
      if (asset.status === 'LOST' || asset.status === 'RETIRED')
        throw new BadRequestException(
          'Cannot schedule maintenance for a lost or retired asset',
        );
      const record = await tx.assetMaintenance.create({
        data: {
          assetId,
          title: dto.title.trim(),
          kind: dto.kind,
          scheduledFor,
          vendor: dto.vendor?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: actor.userId,
        },
      });
      await this.recordAudit(
        tx,
        actor,
        assetId,
        record.id,
        'Created maintenance schedule',
        null,
        record,
      );
      return record;
    });
  }

  async update(
    assetId: number,
    id: number,
    dto: UpdateMaintenanceDto,
    actor: CurrentUserPayload,
  ) {
    return this.change(assetId, id, dto.version, actor, (record) => {
      if (
        dto.title !== undefined &&
        (!dto.title || dto.title.trim().length < 2)
      )
        throw new BadRequestException(
          'Title must contain at least two characters',
        );
      return {
        title: dto.title?.trim(),
        kind: dto.kind,
        scheduledFor:
          dto.scheduledFor === undefined
            ? undefined
            : parseAssetCareDate(dto.scheduledFor),
        vendor:
          dto.vendor === undefined ? record.vendor : dto.vendor?.trim() || null,
        notes:
          dto.notes === undefined ? record.notes : dto.notes?.trim() || null,
      };
    });
  }

  async complete(
    assetId: number,
    id: number,
    dto: CompleteMaintenanceDto,
    actor: CurrentUserPayload,
  ) {
    const performedOn = parseAssetCareDate(dto.performedOn);
    if (performedOn > assetCareDates().start)
      throw new BadRequestException('Performed date cannot be in the future');
    return this.change(assetId, id, dto.version, actor, (record) => ({
      status: AssetMaintenanceStatus.COMPLETED,
      performedOn,
      completedAt: new Date(),
      completedById: actor.userId,
      cost: dto.cost == null ? null : new Prisma.Decimal(dto.cost),
      vendor:
        dto.vendor === undefined ? record.vendor : dto.vendor?.trim() || null,
      notes: dto.notes === undefined ? record.notes : dto.notes?.trim() || null,
    }));
  }

  async cancel(
    assetId: number,
    id: number,
    dto: MaintenanceVersionDto,
    actor: CurrentUserPayload,
  ) {
    return this.change(assetId, id, dto.version, actor, () => ({
      status: AssetMaintenanceStatus.CANCELLED,
    }));
  }

  private async change(
    assetId: number,
    id: number,
    version: number,
    actor: CurrentUserPayload,
    data: (record: {
      vendor: string | null;
      notes: string | null;
    }) => Prisma.AssetMaintenanceUpdateManyMutationInput,
  ) {
    this.assertManager(actor);
    return runSerializableTransaction(this.prisma, async (tx) => {
      const before = await tx.assetMaintenance.findFirst({
        where: { id, assetId },
      });
      if (!before) throw new NotFoundException('Maintenance record not found');
      if (before.status !== 'PLANNED' || before.version !== version)
        throw new ConflictException(
          'Maintenance record changed or already finalized. Reload before saving',
        );
      const claimed = await tx.assetMaintenance.updateMany({
        where: { id, assetId, status: 'PLANNED', version },
        data: { ...data(before), version: { increment: 1 } },
      });
      if (!claimed.count)
        throw new ConflictException(
          'Maintenance record changed. Reload before saving',
        );
      const after = await tx.assetMaintenance.findUniqueOrThrow({
        where: { id },
      });
      await this.recordAudit(
        tx,
        actor,
        assetId,
        id,
        'Updated maintenance record',
        before,
        after,
      );
      return after;
    });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: CurrentUserPayload,
    assetId: number,
    id: number,
    description: string,
    before: unknown,
    after: unknown,
  ) {
    // Dates and Decimal must be plain JSON values in the audit record.
    const json = (value: unknown) =>
      JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
    await this.audit.create(
      {
        actorId: actor.userId,
        entity: 'ASSET',
        entityId: assetId,
        action: before ? 'UPDATE' : 'CREATE',
        description: `${description} #${id} for asset #${assetId}.`,
        ...(before ? { oldValues: json(before) } : {}),
        newValues: json(after),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
      tx,
    );
  }

  async overview(actor: CurrentUserPayload) {
    this.assertManager(actor);
    const now = new Date();
    const { today, end } = assetCareDates(now);
    const warranty = warrantyWindow(now);
    const active = {
      status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] },
    };
    const warrantyWhere: Prisma.AssetWhereInput = {
      ...active,
      warrantyUntil: { gte: warranty.start, lt: warranty.end },
    };
    const maintenanceWhere: Prisma.AssetMaintenanceWhereInput = {
      status: 'PLANNED',
      scheduledFor: { lt: end },
      asset: active,
    };
    const [
      warrantySoon,
      warrantyExpired,
      maintenanceDue,
      warrantyAssets,
      maintenances,
    ] = await this.prisma.$transaction([
      this.prisma.asset.count({ where: warrantyWhere }),
      this.prisma.asset.count({
        where: { ...active, warrantyUntil: { lt: warranty.start } },
      }),
      this.prisma.assetMaintenance.count({ where: maintenanceWhere }),
      this.prisma.asset.findMany({
        where: warrantyWhere,
        orderBy: [{ warrantyUntil: 'asc' }, { id: 'asc' }],
        take: 5,
        select: {
          id: true,
          assetTag: true,
          name: true,
          warrantyUntil: true,
          supplierName: true,
        },
      }),
      this.prisma.assetMaintenance.findMany({
        where: maintenanceWhere,
        orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
        take: 5,
        include: {
          asset: { select: { id: true, assetTag: true, name: true } },
        },
      }),
    ]);
    return {
      today,
      reminderDays: WARRANTY_REMINDER_DAYS,
      warrantySoon,
      warrantyExpired,
      maintenanceDue,
      warrantyAssets,
      maintenances,
    };
  }
}
