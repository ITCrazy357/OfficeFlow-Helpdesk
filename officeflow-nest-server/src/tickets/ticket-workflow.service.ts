import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditLogAction,
  AuditLogEntity,
  type Prisma,
  TicketHistoryAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import { assertTicketAssignee } from '../users/user-lifecycle.policy';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { LinkTicketAssetDto } from './dto/link-ticket-asset.dto';
import { calculateDueAt } from './ticket-sla.util';
import { assertTicketStatusTransition } from './ticket-status.policy';
import { TicketQueryService } from './ticket-query.service';
import { createTicketHistory } from './ticket-history.util';
import {
  resolveCloudinaryDeliveryType,
  resolveCloudinaryResourceType,
} from './ticket-delivery.util';

const ticketStatusSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  resolveAt: true,
  isOverdue: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TicketSelect;

@Injectable()
export class TicketWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,
    private readonly outboxService: OutboxService,
    private readonly query: TicketQueryService,
  ) {}
  private async ensureCategoryExists(categoryId?: number) {
    if (categoryId === undefined) {
      return;
    }

    const category = await this.prisma.ticketCategory.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Ticket category not found');
    }
  }

  async create(
    createTicketDto: CreateTicketDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureCategoryExists(createTicketDto.categoryId);

    const dueAt = calculateDueAt(createTicketDto.priority);

    const ticket = await this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.create({
        data: {
          title: createTicketDto.title,
          description: createTicketDto.description,
          priority: createTicketDto.priority,
          categoryId: createTicketDto.categoryId,
          createdById: currentUser.userId,
          dueAt,
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueAt: true,
          resolveAt: true,
          isOverdue: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await createTicketHistory(transaction, {
        ticketId: ticket.id,
        userId: currentUser.userId,
        action: TicketHistoryAction.CREATE,
        newValue: ticket.title,
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.TICKET,
          entityId: ticket.id,
          action: AuditLogAction.CREATE,
          description: `Created ticket ${ticket.title}.`,
          newValues: {
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            categoryId: ticket.category?.id ?? null,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      await this.outboxService.enqueue(transaction, {
        type: OUTBOX_EVENT_TYPES.TICKET_CREATED,
        payload: { ticketId: ticket.id },
        deduplicationKey: `ticket-created:${ticket.id}`,
      });

      return ticket;
    });

    await this.eventEmitter.emitAsync(
      DASHBOARD_CACHE_INVALIDATE_EVENT,
      new DashboardCacheInvalidatedEvent('TICKET_CREATED', ticket.id),
    );

    return ticket;
  }

  async update(
    id: number,
    updateTicketDto: UpdateTicketDto,
    currentUser: CurrentUserPayload,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        resolveAt: true,
        isOverdue: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        assignedToId: true,
        categoryId: true,
        createdBy: {
          select: {
            departmentId: true,
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (Object.keys(updateTicketDto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (
        !manager?.departmentId ||
        ticket.createdBy.departmentId !== manager.departmentId
      ) {
        throw new ForbiddenException('Forbidden');
      }
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (ticket.createdById !== currentUser.userId) {
        throw new ForbiddenException('Forbidden');
      }

      if (ticket.status !== TicketStatus.OPEN) {
        throw new BadRequestException('Ticket is not open');
      }
    }

    if (
      currentUser.role === UserRole.IT_STAFF &&
      ticket.assignedToId !== null &&
      ticket.assignedToId !== currentUser.userId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    await this.ensureCategoryExists(updateTicketDto.categoryId);

    const updatedTicket = await this.prisma.$transaction(
      async (transaction) => {
        const updatedTicket = await transaction.ticket.update({
          where: { id },
          data: {
            title: updateTicketDto.title,
            description: updateTicketDto.description,
            priority: updateTicketDto.priority,
            categoryId: updateTicketDto.categoryId,
          },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueAt: true,
            resolveAt: true,
            isOverdue: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await createTicketHistory(transaction, {
          ticketId: id,
          userId: currentUser.userId,
          action: TicketHistoryAction.UPDATE,
          oldValue: ticket.title,
          newValue: updatedTicket.title,
        });

        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.TICKET,
            entityId: ticket.id,
            action: AuditLogAction.UPDATE,
            description: `Updated ticket ${updatedTicket.title}.`,
            oldValues: {
              title: ticket.title,
              priority: ticket.priority,
              categoryId: ticket.categoryId,
            },
            newValues: {
              title: updatedTicket.title,
              priority: updatedTicket.priority,
              categoryId: updatedTicket.category?.id ?? null,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );

        return updatedTicket;
      },
    );

    const reportFieldsChanged =
      (updateTicketDto.priority !== undefined &&
        updateTicketDto.priority !== ticket.priority) ||
      (updateTicketDto.categoryId !== undefined &&
        updateTicketDto.categoryId !== ticket.categoryId);

    if (reportFieldsChanged) {
      await this.eventEmitter.emitAsync(
        DASHBOARD_CACHE_INVALIDATE_EVENT,
        new DashboardCacheInvalidatedEvent(
          'TICKET_REPORT_FIELDS_UPDATED',
          updatedTicket.id,
        ),
      );
    }

    return updatedTicket;
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateTicketStatusDto,
    currentUser: CurrentUserPayload,
  ) {
    const nextStatus = updateStatusDto.status;

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { name: true },
    });
    const actorName = actor?.name || 'Someone';

    const result = await runSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const currentTicket = await transaction.ticket.findUnique({
          where: {
            id,
          },
          select: ticketStatusSelect,
        });

        if (!currentTicket) {
          throw new NotFoundException('Ticket not found');
        }

        if (currentTicket.status === nextStatus) {
          return {
            statusChanged: false,
            previousTicket: currentTicket,
            updatedTicket: currentTicket,
          };
        }

        assertTicketStatusTransition(currentTicket.status, nextStatus);

        if (
          nextStatus === TicketStatus.IN_PROGRESS &&
          currentTicket.assignedTo
        ) {
          await assertTicketAssignee(transaction, currentTicket.assignedTo.id);
        }

        const resolveAt =
          nextStatus === TicketStatus.RESOLVED
            ? new Date()
            : nextStatus === TicketStatus.CLOSED
              ? currentTicket.resolveAt
              : null;

        const claimed = await transaction.ticket.updateMany({
          where: {
            id,
            status: currentTicket.status,
          },
          data: {
            status: nextStatus,
            resolveAt,
          },
        });

        if (claimed.count !== 1) {
          throw new ConflictException(
            'Ticket status changed concurrently. Please retry',
          );
        }

        const updatedTicket = await transaction.ticket.findUnique({
          where: {
            id,
          },
          select: ticketStatusSelect,
        });

        if (!updatedTicket) {
          throw new NotFoundException('Ticket not found');
        }

        await createTicketHistory(transaction, {
          ticketId: id,
          userId: currentUser.userId,
          action: TicketHistoryAction.STATUS_CHANGED,
          oldValue: currentTicket.status,
          newValue: updatedTicket.status,
        });

        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.TICKET,
            entityId: currentTicket.id,
            action: AuditLogAction.STATUS_CHANGED,
            description: `Changed status of ticket ${currentTicket.title}.`,
            oldValues: {
              status: currentTicket.status,
            },
            newValues: {
              status: updatedTicket.status,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );

        const recipientIds = [
          currentTicket.createdBy.id,
          currentTicket.assignedTo?.id,
        ].filter((userId): userId is number => Boolean(userId));

        await this.outboxService.enqueue(transaction, {
          type: OUTBOX_EVENT_TYPES.TICKET_STATUS_CHANGED,
          payload: {
            ticketId: id,
            ticketTitle: currentTicket.title,
            changedById: currentUser.userId,
            changedByName: actorName,
            oldStatus: currentTicket.status,
            newStatus: updatedTicket.status,
            recipientIds,
          },
        });

        if (updatedTicket.status === TicketStatus.RESOLVED) {
          await this.outboxService.enqueue(transaction, {
            type: OUTBOX_EVENT_TYPES.TICKET_RESOLVED,
            payload: {
              ticketId: id,
              ticketTitle: currentTicket.title,
              resolverId: currentUser.userId,
              resolverName: actorName,
              recipientIds,
            },
          });
        }

        return {
          statusChanged: true,
          previousTicket: currentTicket,
          updatedTicket,
        };
      },
    );

    if (result.statusChanged) {
      await this.eventEmitter.emitAsync(
        DASHBOARD_CACHE_INVALIDATE_EVENT,
        new DashboardCacheInvalidatedEvent('TICKET_STATUS_CHANGED', id),
      );
    }

    return result.updatedTicket;
  }

  async assign(
    id: number,
    assignTicketDto: AssignTicketDto,
    currentUser: CurrentUserPayload,
  ) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const updatedTicket = await runSerializableTransaction(
      this.prisma,
      async (transaction) => {
        const ticket = await transaction.ticket.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            assignedToId: true,
          },
        });

        if (!ticket) {
          throw new NotFoundException('Ticket not found');
        }

        await assertTicketAssignee(transaction, assignTicketDto.assignedToId);

        const actor = await transaction.user.findUnique({
          where: { id: currentUser.userId },
          select: {
            name: true,
          },
        });

        if (!actor) {
          throw new NotFoundException('Actor not found');
        }

        const result = await transaction.ticket.update({
          where: { id },
          data: {
            assignedToId: assignTicketDto.assignedToId,
          },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueAt: true,
            resolveAt: true,
            isOverdue: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await createTicketHistory(transaction, {
          ticketId: id,
          userId: currentUser.userId,
          action: TicketHistoryAction.ASSIGNED,
          oldValue: ticket.assignedToId
            ? String(ticket.assignedToId)
            : undefined,
          newValue: String(assignTicketDto.assignedToId),
        });

        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.TICKET,
            entityId: ticket.id,
            action: AuditLogAction.ASSIGNED,
            description: `Assigned ticket ${ticket.title}.`,
            oldValues: {
              assignedToId: ticket.assignedToId,
            },
            newValues: {
              assignedToId: assignTicketDto.assignedToId,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );

        if (ticket.assignedToId !== assignTicketDto.assignedToId) {
          await this.outboxService.enqueue(transaction, {
            type: OUTBOX_EVENT_TYPES.TICKET_ASSIGNED,
            payload: {
              ticketId: id,
              ticketTitle: ticket.title,
              assignedToId: assignTicketDto.assignedToId,
              assignedByName: actor.name || 'Someone',
            },
          });
        }

        return result;
      },
    );

    return updatedTicket;
  }

  async remove(id: number, currentUser: CurrentUserPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdById: true,
        status: true,
        attachments: {
          select: {
            id: true,
            fileUrl: true,
            publicId: true,
            resourceType: true,
            deliveryType: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const canDelete =
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.EMPLOYEE &&
        ticket.createdById === currentUser.userId &&
        ticket.status === TicketStatus.OPEN);

    if (!canDelete) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.ticket.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          actorId: currentUser.userId,
          entity: AuditLogEntity.TICKET,
          entityId: ticket.id,
          action: AuditLogAction.DELETED,
          description: `Deleted ticket ${ticket.title}.`,
          oldValues: {
            title: ticket.title,
            status: ticket.status,
            createdById: ticket.createdById,
          },
          ipAddress: currentUser.ipAddress,
          userAgent: currentUser.userAgent,
        },
        transaction,
      );

      for (const attachment of ticket.attachments) {
        if (!attachment.publicId) {
          continue;
        }

        await this.outboxService.enqueue(transaction, {
          type: OUTBOX_EVENT_TYPES.CLOUDINARY_ASSET_DELETE,
          payload: {
            publicId: attachment.publicId,
            resourceType: resolveCloudinaryResourceType(
              attachment.resourceType,
              attachment.fileUrl,
            ),
            deliveryType: resolveCloudinaryDeliveryType(
              attachment.deliveryType,
            ),
          },
          deduplicationKey: `cloudinary-delete:ticket:${ticket.id}:attachment:${attachment.id}`,
        });
      }
    });

    await this.eventEmitter.emitAsync(
      DASHBOARD_CACHE_INVALIDATE_EVENT,
      new DashboardCacheInvalidatedEvent('TICKET_DELETED', id),
    );

    return { id };
  }


  async linkAsset(
    ticketId: number,
    linkTicketAssetDto: LinkTicketAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const [ticket, asset] = await Promise.all([
      this.query.canGetById(ticketId, currentUser),
      this.prisma.asset.findUnique({
        where: {
          id: linkTicketAssetDto.assetId,
        },
        select: {
          id: true,
          assignedToId: true,
        },
      }),
    ]);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const canManage =
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.IT_STAFF;

    // Users without asset-management access can only link their own asset.
    if (!canManage && asset.assignedToId !== currentUser.userId) {
      throw new ForbiddenException(
        'You may only link an asset assigned to you',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const updatedTicket = await transaction.ticket.update({
        where: {
          id: ticketId,
        },
        data: {
          assetId: asset.id,
        },
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              type: true,
              status: true,
            },
          },
        },
      });

      if (ticket.asset?.id !== asset.id) {
        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.TICKET,
            entityId: ticket.id,
            action: AuditLogAction.LINKED,
            description: `Linked asset to ticket ${ticket.title}.`,
            oldValues: {
              assetId: ticket.asset?.id ?? null,
            },
            newValues: {
              assetId: asset.id,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );
      }

      return updatedTicket;
    });
  }

  async unlinkAsset(ticketId: number, currentUser: CurrentUserPayload) {
    const ticket = await this.query.canGetById(ticketId, currentUser);

    return this.prisma.$transaction(async (transaction) => {
      const updatedTicket = await transaction.ticket.update({
        where: {
          id: ticketId,
        },
        data: {
          assetId: null,
        },
      });

      if (ticket.asset) {
        await this.auditLogsService.create(
          {
            actorId: currentUser.userId,
            entity: AuditLogEntity.TICKET,
            entityId: ticket.id,
            action: AuditLogAction.UNLINKED,
            description: `Unlinked asset from ticket ${ticket.title}.`,
            oldValues: {
              assetId: ticket.asset.id,
            },
            newValues: {
              assetId: null,
            },
            ipAddress: currentUser.ipAddress,
            userAgent: currentUser.userAgent,
          },
          transaction,
        );
      }

      return updatedTicket;
    });
  }
}
