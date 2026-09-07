import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  LeaveStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly, startOfUtcDate } from '../utils/formatDate';

import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import {
  GetLeaveRequestDto,
  LeaveRequestPaginationQueryDto,
} from './dto/get-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';

const leaveRequestDetailSelect = {
  id: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: {
      id: true,
      name: true,
    },
  },
  approver: {
    select: {
      id: true,
      name: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.LeaveRequestSelect;

function dtoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class LeaveRequestService {
  private static readonly MAX_CREATE_ATTEMPTS = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly outboxService: OutboxService,
  ) {}

  private async createInSerializableTransaction(
    currentUser: CurrentUserPayload,
    startDate: Date,
    endDate: Date,
    reason: string,
  ) {
    const requesterId = currentUser.userId;

    for (
      let attempt = 1;
      attempt <= LeaveRequestService.MAX_CREATE_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const requester = await tx.user.findUnique({
              where: {
                id: requesterId,
              },
              select: {
                manager: {
                  select: {
                    id: true,
                    role: true,
                    isActive: true,
                    isLocked: true,
                  },
                },
              },
            });

            if (!requester) {
              throw new UnauthorizedException(
                'Authenticated user no longer exists',
              );
            }

            const manager = requester.manager;

            if (!manager || !manager.isActive || manager.isLocked) {
              throw new UnprocessableEntityException(
                'Assigned manager is not available for leave approval',
              );
            }

            const canApprove =
              manager.role === UserRole.MANAGER ||
              manager.role === UserRole.ADMIN;

            if (!canApprove) {
              throw new UnprocessableEntityException(
                'Assigned manager cannot approve leave requests',
              );
            }

            if (manager.id === requesterId) {
              throw new UnprocessableEntityException(
                'You cannot be the approver of your own leave request',
              );
            }

            const existing = await tx.leaveRequest.findFirst({
              where: {
                requesterId,
                status: {
                  in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
                },
                startDate: {
                  lte: endDate,
                },
                endDate: {
                  gte: startDate,
                },
              },
              select: {
                id: true,
              },
            });

            if (existing) {
              throw new ConflictException(
                'Leave request overlaps with an existing request',
              );
            }

            const leaveRequest = await tx.leaveRequest.create({
              data: {
                requesterId,
                approverId: manager.id,
                startDate,
                endDate,
                reason,
              },
              select: leaveRequestDetailSelect,
            });

            await this.auditLogsService.create(
              {
                actorId: requesterId,
                entity: AuditLogEntity.LEAVE_REQUEST,
                entityId: leaveRequest.id,
                action: AuditLogAction.CREATE,
                description: `Created leave request ${leaveRequest.id}.`,
                newValues: {
                  requesterId,
                  approverId: manager.id,
                  status: LeaveStatus.PENDING,
                  startDate: dtoDate(startDate),
                  endDate: dtoDate(endDate),
                },
                ipAddress: currentUser.ipAddress,
                userAgent: currentUser.userAgent,
              },
              tx,
            );

            await this.outboxService.enqueue(tx, {
              type: OUTBOX_EVENT_TYPES.LEAVE_REQUESTED,
              payload: {
                leaveRequestId: leaveRequest.id,
              },
              deduplicationKey: `leave-requested:${leaveRequest.id}`,
            });

            return leaveRequest;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error: unknown) {
        const isWriteConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isWriteConflict) {
          throw error;
        }

        if (attempt === LeaveRequestService.MAX_CREATE_ATTEMPTS) {
          throw new ConflictException(
            'Leave request could not be created due to a concurrent update',
          );
        }
      }
    }

    throw new ConflictException('Could not create leave request');
  }

  async create(dto: CreateLeaveRequestDto, currentUser: CurrentUserPayload) {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    const today = startOfUtcDate(new Date());

    if (startDate > endDate) {
      throw new BadRequestException(
        'Start date must be before or equal to end date',
      );
    }

    if (startDate < today) {
      throw new BadRequestException('Start date can not be in the past');
    }

    return this.createInSerializableTransaction(
      currentUser,
      startDate,
      endDate,
      dto.reason,
    );
  }

  async findMine(currentUser: CurrentUserPayload, query: GetLeaveRequestDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {
      requesterId: currentUser.userId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: leaveRequestDetailSelect,
      }),

      this.prisma.leaveRequest.count({
        where,
      }),
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

  async findPendingApproval(
    currentUser: CurrentUserPayload,
    query: LeaveRequestPaginationQueryDto,
  ) {
    if (
      currentUser.role !== UserRole.MANAGER &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.LeaveRequestWhereInput = {
      approverId: currentUser.userId,
      status: LeaveStatus.PENDING,
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: leaveRequestDetailSelect,
      }),
      this.prisma.leaveRequest.count({ where }),
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

  async findOne(leaveRequestId: number, currentUser: CurrentUserPayload) {
    const canReview =
      currentUser.role === UserRole.MANAGER ||
      currentUser.role === UserRole.ADMIN;

    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: {
        id: leaveRequestId,
        OR: [
          { requesterId: currentUser.userId },
          ...(canReview ? [{ approverId: currentUser.userId }] : []),
        ],
      },
      select: leaveRequestDetailSelect,
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    return leaveRequest;
  }

  private async review(
    leaveRequestId: number,
    actor: CurrentUserPayload,
    newStatus: typeof LeaveStatus.APPROVED | typeof LeaveStatus.REJECTED,
    reviewNote?: string,
  ) {
    if (actor.role !== UserRole.MANAGER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Forbidden');
    }

    const normalizedReviewNote = reviewNote?.trim();

    if (newStatus === LeaveStatus.REJECTED && !normalizedReviewNote) {
      throw new BadRequestException('Review note is required for rejection');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findFirst({
        where: {
          id: leaveRequestId,
          approverId: actor.userId,
        },
        select: {
          id: true,
          requesterId: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Leave request not found');
      }

      if (existing.requesterId === actor.userId) {
        throw new ForbiddenException(
          'You cannot review your own leave request',
        );
      }

      if (existing.status !== LeaveStatus.PENDING) {
        throw new ConflictException('Leave request has already been processed');
      }

      const reviewedAt = new Date();
      const result = await tx.leaveRequest.updateMany({
        where: {
          id: leaveRequestId,
          approverId: actor.userId,
          status: LeaveStatus.PENDING,
        },
        data: {
          status: newStatus,
          reviewNote:
            newStatus === LeaveStatus.REJECTED ? normalizedReviewNote : null,
          reviewedAt,
          reviewedById: actor.userId,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException('Leave request is no longer pending');
      }

      await this.auditLogsService.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.LEAVE_REQUEST,
          entityId: leaveRequestId,
          action: AuditLogAction.STATUS_CHANGED,
          description: `${newStatus === LeaveStatus.APPROVED ? 'Approved' : 'Rejected'} leave request ${leaveRequestId}.`,
          oldValues: {
            status: LeaveStatus.PENDING,
          },
          newValues: {
            status: newStatus,
            reviewedAt: reviewedAt.toISOString(),
            reviewedById: actor.userId,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        tx,
      );

      await this.outboxService.enqueue(tx, {
        type:
          newStatus === LeaveStatus.APPROVED
            ? OUTBOX_EVENT_TYPES.LEAVE_APPROVED
            : OUTBOX_EVENT_TYPES.LEAVE_REJECTED,
        payload: {
          leaveRequestId,
        },
        deduplicationKey: `leave-${newStatus.toLowerCase()}:${leaveRequestId}`,
      });

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: leaveRequestId },
        select: leaveRequestDetailSelect,
      });
    });
  }

  async approve(leaveRequestId: number, actor: CurrentUserPayload) {
    return this.review(leaveRequestId, actor, LeaveStatus.APPROVED);
  }

  async reject(
    leaveRequestId: number,
    dto: RejectLeaveRequestDto,
    actor: CurrentUserPayload,
  ) {
    return this.review(
      leaveRequestId,
      actor,
      LeaveStatus.REJECTED,
      dto.reviewNote,
    );
  }

  async cancel(leaveRequestId: number, actor: CurrentUserPayload) {
    const leaveRequest = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findFirst({
        where: {
          id: leaveRequestId,
          requesterId: actor.userId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Leave request not found');
      }

      if (existing.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
          'Only a pending leave request can be cancelled',
        );
      }

      const result = await tx.leaveRequest.updateMany({
        where: {
          id: leaveRequestId,
          requesterId: actor.userId,
          status: LeaveStatus.PENDING,
        },
        data: {
          status: LeaveStatus.CANCELLED,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException('Leave request is no longer pending');
      }

      await this.auditLogsService.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.LEAVE_REQUEST,
          entityId: leaveRequestId,
          action: AuditLogAction.STATUS_CHANGED,
          description: `Cancelled leave request ${leaveRequestId}.`,
          oldValues: {
            status: LeaveStatus.PENDING,
          },
          newValues: {
            status: LeaveStatus.CANCELLED,
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        tx,
      );

      await this.outboxService.enqueue(tx, {
        type: OUTBOX_EVENT_TYPES.LEAVE_CANCELLED,
        payload: {
          leaveRequestId,
        },
        deduplicationKey: `leave-cancelled:${leaveRequestId}`,
      });

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: leaveRequestId },
        select: leaveRequestDetailSelect,
      });
    });

    return leaveRequest;
  }
}
