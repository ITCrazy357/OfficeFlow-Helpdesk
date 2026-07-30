import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import type { Request } from 'express';
import type {} from 'multer';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CloudinaryService,
  type CloudinaryResourceType,
} from '../cloudinary/cloudinary.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { TicketAssignedEvent } from '../notifications/events/ticket-assigned.event';
import { TicketCommentedEvent } from '../notifications/events/ticket-commented.event';
import { TicketStatusChangedEvent } from '../notifications/events/ticket-status-changed.event';
import { PrismaService } from '../prisma/prisma.service';

import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { GetTicketsQueryDto } from './dto/get-tickets-query.dto';
import { LinkTicketAssetDto } from './dto/link-ticket-asset.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { calculateDueAt } from './ticket-sla.util';

export type TicketAttachmentFile = NonNullable<Request['file']>;

function resolveCloudinaryResourceType(
  resourceType: string | null,
  fileUrl: string,
): CloudinaryResourceType {
  if (
    resourceType === 'image' ||
    resourceType === 'raw' ||
    resourceType === 'video'
  ) {
    return resourceType;
  }

  const resourceTypeFromUrl = fileUrl.match(
    /\/(image|raw|video)\/upload(?:\/|$)/,
  )?.[1];

  if (
    resourceTypeFromUrl === 'image' ||
    resourceTypeFromUrl === 'raw' ||
    resourceTypeFromUrl === 'video'
  ) {
    return resourceTypeFromUrl;
  }

  return 'image';
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,
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

  async getTickets(currentUser: CurrentUserPayload, query: GetTicketsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    if (currentUser.role === UserRole.EMPLOYEE) {
      where.createdById = currentUser.userId;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (!manager?.departmentId) {
        where.createdById = currentUser.userId;
      } else {
        where.createdBy = {
          departmentId: manager.departmentId,
        };
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (typeof query.isOverdue === 'boolean') {
      where.isOverdue = query.isOverdue;
    }

    if (query.keyword) {
      where.OR = [
        {
          title: {
            contains: query.keyword,
          },
        },
        {
          description: {
            contains: query.keyword,
          },
        },
      ];
    }

    const [tickets, totalItems] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
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
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              type: true,
              status: true,
              brand: true,
              model: true,
              serialNumber: true,
            },
          },
        },
      }),

      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: tickets,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async create(
    createTicketDto: CreateTicketDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.ensureCategoryExists(createTicketDto.categoryId);

    const dueAt = calculateDueAt(createTicketDto.priority);

    return this.prisma.$transaction(async (transaction) => {
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

      await this.createHistory(
        {
          ticketId: ticket.id,
          userId: currentUser.userId,
          action: TicketHistoryAction.CREATE,
          newValue: ticket.title,
        },
        transaction,
      );

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

      return ticket;
    });
  }

  async canGetById(id: number, currentUser: CurrentUserPayload) {
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
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
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
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            type: true,
            status: true,
            brand: true,
            model: true,
            serialNumber: true,
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      ticket.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException('You are not allowed to view this ticket');
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

    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      dueAt: ticket.dueAt,
      resolveAt: ticket.resolveAt,
      isOverdue: ticket.isOverdue,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: {
        id: ticket.createdBy.id,
        name: ticket.createdBy.name,
        email: ticket.createdBy.email,
      },
      assignedTo: ticket.assignedTo,
      category: ticket.category,
      asset: ticket.asset,
    };
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
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

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

    return this.prisma.$transaction(async (transaction) => {
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

      await this.createHistory(
        {
          ticketId: id,
          userId: currentUser.userId,
          action: TicketHistoryAction.UPDATE,
          oldValue: ticket.title,
          newValue: updatedTicket.title,
        },
        transaction,
      );

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
    });
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateTicketStatusDto,
    currentUser: CurrentUserPayload,
  ) {
    const nextStatus = updateStatusDto.status;

    const shouldSetResolveAt =
      nextStatus === TicketStatus.RESOLVED ||
      nextStatus === TicketStatus.CLOSED;

    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updatedTicket = await this.prisma.$transaction(
      async (transaction) => {
        const result = await transaction.ticket.update({
          where: { id },
          data: {
            status: updateStatusDto.status,
            resolveAt: shouldSetResolveAt ? new Date() : null,
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

        await this.createHistory(
          {
            ticketId: id,
            userId: currentUser.userId,
            action: TicketHistoryAction.STATUS_CHANGED,
            oldValue: ticket.status,
            newValue: result.status,
          },
          transaction,
        );

        if (ticket.status !== result.status) {
          await this.auditLogsService.create(
            {
              actorId: currentUser.userId,
              entity: AuditLogEntity.TICKET,
              entityId: ticket.id,
              action: AuditLogAction.STATUS_CHANGED,
              description: `Changed status of ticket ${ticket.title}.`,
              oldValues: {
                status: ticket.status,
              },
              newValues: {
                status: result.status,
              },
              ipAddress: currentUser.ipAddress,
              userAgent: currentUser.userAgent,
            },
            transaction,
          );
        }

        return result;
      },
    );

    const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
      (userId): userId is number => Boolean(userId),
    );

    const actor = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        name: true,
      },
    });

    this.eventEmitter.emit(
      'ticket.status_changed',
      new TicketStatusChangedEvent(
        id,
        ticket.title,
        currentUser.userId,
        actor?.name || 'Someone',
        ticket.status,
        updatedTicket.status,
        recipientIds,
      ),
    );

    return updatedTicket;
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

    const ticket = await this.prisma.ticket.findUnique({
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

    const assigned = await this.prisma.user.findUnique({
      where: { id: assignTicketDto.assignedToId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!assigned) {
      throw new NotFoundException('Assignee not found');
    }

    if (
      assigned.role !== UserRole.IT_STAFF &&
      assigned.role !== UserRole.ADMIN
    ) {
      throw new BadRequestException('Assignee must be IT staff or admin');
    }

    const updatedTicket = await this.prisma.$transaction(
      async (transaction) => {
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

        await this.createHistory(
          {
            ticketId: id,
            userId: currentUser.userId,
            action: TicketHistoryAction.ASSIGNED,
            oldValue: ticket.assignedToId
              ? String(ticket.assignedToId)
              : undefined,
            newValue: String(assignTicketDto.assignedToId),
          },
          transaction,
        );

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

        return result;
      },
    );

    const actor = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        name: true,
      },
    });

    if (!actor) throw new NotFoundException('Actor not found');

    this.eventEmitter.emit(
      'ticket.assigned',
      new TicketAssignedEvent(
        id,
        ticket.title,
        assignTicketDto.assignedToId,
        actor.name || 'Someone',
      ),
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
            fileUrl: true,
            publicId: true,
            resourceType: true,
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

    await Promise.all(
      ticket.attachments.map((attachment) => {
        if (!attachment.publicId) {
          return Promise.resolve();
        }

        return this.cloudinaryService.deleteFile(
          attachment.publicId,
          resolveCloudinaryResourceType(
            attachment.resourceType,
            attachment.fileUrl,
          ),
        );
      }),
    );

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
    });

    return { id };
  }

  //Cho phép ADMIN, IT_STAFF và MANAGER(có cùng phòng ban vói người tạo ra ticket) truy cập vào ticket
  private async canAccessTicket(
    ticketId: number,
    currentUser: CurrentUserPayload,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdById: true,
        createdBy: {
          select: {
            departmentId: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.IT_STAFF
    ) {
      return ticket;
    }

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      ticket.createdById === currentUser.userId
    ) {
      return ticket;
    }

    if (currentUser.role === UserRole.MANAGER) {
      const manager = await this.prisma.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true },
      });

      if (!manager?.departmentId) {
        throw new ForbiddenException('Forbidden');
      }

      if (ticket.createdBy.departmentId !== manager.departmentId) {
        throw new ForbiddenException('Forbidden');
      }
      return ticket;
    }
    throw new ForbiddenException('Forbidden');
  }

  //Tạo lịch sử ticket
  private async createHistory(
    params: {
      ticketId: number;
      userId: number;
      action: TicketHistoryAction;
      oldValue?: string;
      newValue?: string;
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const database = transaction ?? this.prisma;

    return database.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        userId: params.userId,
        action: params.action,
        oldValue: params.oldValue,
        newValue: params.newValue,
      },
    });
  }

  //Them comments

  async addComment(
    ticketId: number,
    createCommentDto: CreateTicketCommentDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.canAccessTicket(ticketId, currentUser);

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: currentUser.userId,
        content: createCommentDto.content,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        createdById: true,
        assignedToId: true,
      },
    });

    if (ticket) {
      const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
        (id): id is number => Boolean(id),
      );

      this.eventEmitter.emit(
        'ticket.commented',
        new TicketCommentedEvent(
          ticket.id,
          ticket.title,
          currentUser.userId,
          comment.author.name,
          recipientIds,
        ),
      );
    }

    await this.createHistory({
      ticketId,
      userId: currentUser.userId,
      action: TicketHistoryAction.COMMENTED,
      newValue: comment.content,
    });
    return comment;
  }

  // Lấy nội dung comment
  async getComments(ticketId: number, currentUser: CurrentUserPayload) {
    await this.canAccessTicket(ticketId, currentUser);

    const comments = await this.prisma.ticketComment.findMany({
      where: { ticketId },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return comments;
  }

  //Lấy lịch sử comment
  async getHistory(ticketId: number, currentUser: CurrentUserPayload) {
    await this.canAccessTicket(ticketId, currentUser);

    const histories = await this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        action: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return histories;
  }

  async uploadAttachment(
    ticketId: number,
    file: TicketAttachmentFile,
    currentUser: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    await this.canAccessTicket(ticketId, currentUser);

    const uploadedFile = await this.cloudinaryService.uploadFile(
      file,
      'officeflow/ticket-attachments',
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const attachment = await transaction.ticketAttachment.create({
          data: {
            ticketId,
            uploadedById: currentUser.userId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            fileUrl: uploadedFile.secureUrl,
            publicId: uploadedFile.publicId,
            resourceType: uploadedFile.resourceType,
          },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

        await transaction.ticketHistory.create({
          data: {
            ticketId,
            userId: currentUser.userId,
            action: TicketHistoryAction.ATTACHMENT_ADDED,
            newValue: attachment.fileName,
          },
        });

        return attachment;
      });
    } catch (error) {
      try {
        await this.cloudinaryService.deleteFile(
          uploadedFile.publicId,
          uploadedFile.resourceType,
        );
      } catch (cleanupError) {
        this.logger.error(
          `Could not clean up Cloudinary asset ${uploadedFile.publicId}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      throw error;
    }
  }

  async getAttachments(ticketId: number, currentUser: CurrentUserPayload) {
    await this.canAccessTicket(ticketId, currentUser);

    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return attachments;
  }

  async deleteAttachment(
    ticketId: number,
    attachmentId: number,
    currentUser: CurrentUserPayload,
  ) {
    await this.canAccessTicket(ticketId, currentUser);

    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: {
        id: attachmentId,
        ticketId,
      },
      select: {
        fileName: true,
        fileUrl: true,
        publicId: true,
        resourceType: true,
        uploadedById: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (currentUser.role === UserRole.MANAGER) {
      throw new ForbiddenException('Forbidden');
    }

    if (
      currentUser.role === UserRole.EMPLOYEE &&
      attachment.uploadedById !== currentUser.userId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    if (attachment.publicId) {
      await this.cloudinaryService.deleteFile(
        attachment.publicId,
        resolveCloudinaryResourceType(
          attachment.resourceType,
          attachment.fileUrl,
        ),
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.ticketAttachment.deleteMany({
        where: {
          id: attachmentId,
          ticketId,
        },
      });

      if (deleted.count !== 1) {
        throw new NotFoundException('Attachment not found');
      }

      await transaction.ticketHistory.create({
        data: {
          ticketId,
          userId: currentUser.userId,
          action: TicketHistoryAction.ATTACHMENT_DELETED,
          newValue: attachment.fileName,
        },
      });
    });

    return { id: attachmentId };
  }

  async linkAsset(
    ticketId: number,
    linkTicketAssetDto: LinkTicketAssetDto,
    currentUser: CurrentUserPayload,
  ) {
    const [ticket, asset] = await Promise.all([
      this.canGetById(ticketId, currentUser),
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
    const ticket = await this.canGetById(ticketId, currentUser);

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
