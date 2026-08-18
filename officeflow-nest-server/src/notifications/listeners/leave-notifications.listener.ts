import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeaveStatus, NotificationType } from '@prisma/client';

import { LeaveApprovedEvent } from '../../leave-requests/events/leave-approved.event';
import { LeaveCancelledEvent } from '../../leave-requests/events/leave-cancelled.event';
import { LeaveRejectedEvent } from '../../leave-requests/events/leave-rejected.event';
import { LeaveRequestedEvent } from '../../leave-requests/events/leave-requested.event';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class LeaveNotificationsListener {
  private readonly logger = new Logger(LeaveNotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('leave.requested', { async: true, suppressErrors: true })
  async handleRequested(event: LeaveRequestedEvent) {
    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: event.leaveRequestId },
        select: {
          id: true,
          approverId: true,
          status: true,
          startDate: true,
          endDate: true,
          requester: {
            select: { name: true },
          },
        },
      });

      if (!leaveRequest || leaveRequest.status !== LeaveStatus.PENDING) {
        this.logger.warn(
          `Cannot create leave-requested notification: leave request ${event.leaveRequestId} was not found`,
        );
        return;
      }

      await this.notificationsService.create({
        userId: leaveRequest.approverId,
        type: NotificationType.LEAVE_REQUESTED,
        title: 'Leave request awaiting review',
        message:
          `${leaveRequest.requester.name} requested leave from ` +
          `${formatDateOnly(leaveRequest.startDate)} to ${formatDateOnly(leaveRequest.endDate)}.`,
        targetUrl: `/leave-requests/${leaveRequest.id}`,
      });
    } catch (error: unknown) {
      this.logError('leave-requested', error);
    }
  }

  @OnEvent('leave.approved', { async: true, suppressErrors: true })
  async handleApproved(event: LeaveApprovedEvent) {
    await this.createDecisionNotification(
      event.leaveRequestId,
      NotificationType.LEAVE_APPROVED,
      LeaveStatus.APPROVED,
      'Leave request approved',
      'Your leave request was approved.',
    );
  }

  @OnEvent('leave.rejected', { async: true, suppressErrors: true })
  async handleRejected(event: LeaveRejectedEvent) {
    await this.createDecisionNotification(
      event.leaveRequestId,
      NotificationType.LEAVE_REJECTED,
      LeaveStatus.REJECTED,
      'Leave request rejected',
      'Your leave request was rejected. Open it to review the decision.',
    );
  }

  @OnEvent('leave.cancelled', { async: true, suppressErrors: true })
  async handleCancelled(event: LeaveCancelledEvent) {
    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: event.leaveRequestId },
        select: {
          id: true,
          approverId: true,
          status: true,
          requester: {
            select: { name: true },
          },
        },
      });

      if (!leaveRequest || leaveRequest.status !== LeaveStatus.CANCELLED) {
        this.logger.warn(
          `Cannot create leave-cancelled notification: leave request ${event.leaveRequestId} was not found`,
        );
        return;
      }

      await this.notificationsService.create({
        userId: leaveRequest.approverId,
        type: NotificationType.LEAVE_CANCELLED,
        title: 'Leave request cancelled',
        message: `${leaveRequest.requester.name} cancelled a pending leave request.`,
        targetUrl: `/leave-requests/${leaveRequest.id}`,
      });
    } catch (error: unknown) {
      this.logError('leave-cancelled', error);
    }
  }

  private async createDecisionNotification(
    leaveRequestId: number,
    type: NotificationType,
    expectedStatus: typeof LeaveStatus.APPROVED | typeof LeaveStatus.REJECTED,
    title: string,
    message: string,
  ) {
    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        select: {
          id: true,
          requesterId: true,
          status: true,
        },
      });

      if (!leaveRequest || leaveRequest.status !== expectedStatus) {
        this.logger.warn(
          `Cannot create leave decision notification: leave request ${leaveRequestId} was not found`,
        );
        return;
      }

      await this.notificationsService.create({
        userId: leaveRequest.requesterId,
        type,
        title,
        message,
        targetUrl: `/leave-requests/${leaveRequest.id}`,
      });
    } catch (error: unknown) {
      this.logError('leave-decision', error);
    }
  }

  private logError(eventName: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown notification error';
    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `Failed to handle ${eventName} notification: ${message}`,
      stack,
    );
  }
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
