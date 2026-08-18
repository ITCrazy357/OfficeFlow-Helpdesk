import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeaveStatus, Prisma, UserRole } from '@prisma/client';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly, startOfUtcDate } from '../utils/formatDate';

import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveRequestedEvent } from './events/leave-requested.event';

@Injectable()
export class LeaveRequestService {
  private static readonly MAX_CREATE_ATTEMPTS = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    const leaveRequest = await this.createInSerializableTransaction(
      currentUser.userId,
      startDate,
      endDate,
      dto.reason,
    );

    this.eventEmitter.emit(
      'leave.requested',
      new LeaveRequestedEvent(leaveRequest.id),
    );

    return leaveRequest;
  }

  private async createInSerializableTransaction(
    requesterId: number,
    startDate: Date,
    endDate: Date,
    reason: string,
  ) {
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

            return tx.leaveRequest.create({
              data: {
                requesterId,
                approverId: manager.id,
                startDate,
                endDate,
                reason,
              },
              select: {
                id: true,
                startDate: true,
                endDate: true,
                reason: true,
                status: true,
                createdAt: true,
                approver: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            });
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
}
