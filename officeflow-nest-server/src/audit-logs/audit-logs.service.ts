import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogAction, AuditLogEntity, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GetAuditLogsQueryDto } from './dto/get-audit-logs-query.dto';

export type CreateAuditLogParams = {
  actorId?: number | null;
  entity: AuditLogEntity;
  entityId?: number | null;
  action: AuditLogAction;
  description: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    params: CreateAuditLogParams,
    transaction?: Prisma.TransactionClient,
  ) {
    const database = transaction ?? this.prisma;

    return database.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        entity: params.entity,
        entityId: params.entityId ?? null,
        action: params.action,
        description: params.description,
        oldValues: params.oldValues,
        newValues: params.newValues,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
      select: {
        id: true,
        actorId: true,
        entity: true,
        entityId: true,
        action: true,
        description: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
      },
    });
  }

  async findAll(query: GetAuditLogsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (query.entity) {
      where.entity = query.entity;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.keyword?.trim()) {
      where.description = {
        contains: query.keyword.trim(),
      };
    }

    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;

      if (from && to && from > to) {
        throw new BadRequestException(
          'Start date must be before or equal to end date',
        );
      }

      where.createdAt = {
        gte: from,
        lte: to,
      };
    }

    const [auditLogs, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({
        where,
      }),
    ]);

    return {
      items: auditLogs,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: number) {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: {
        id,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return auditLog;
  }
}
