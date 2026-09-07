import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeaveStatus } from '@prisma/client';

import { LeaveApprovedEvent } from '../../leave-requests/events/leave-approved.event';
import { LeaveCancelledEvent } from '../../leave-requests/events/leave-cancelled.event';
import { LeaveRejectedEvent } from '../../leave-requests/events/leave-rejected.event';
import { LeaveRequestedEvent } from '../../leave-requests/events/leave-requested.event';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { leaveRequestEmailTemplate } from '../templates/leave-request-email.template';

@Injectable()
export class LeaveEmailListener {
  private readonly logger = new Logger(LeaveEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('leave.requested', { suppressErrors: false })
  async handleRequested(event: LeaveRequestedEvent) {
    if (!this.mailService.isEnabled()) return;

    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: event.leaveRequestId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          requester: { select: { name: true } },
          approver: {
            select: { name: true, email: true, isActive: true },
          },
        },
      });

      if (
        !leaveRequest ||
        leaveRequest.status !== LeaveStatus.PENDING ||
        !leaveRequest.approver.email ||
        !leaveRequest.approver.isActive
      ) {
        this.logger.warn(
          `Cannot send leave-requested email for leave request ${event.leaveRequestId}`,
        );
        return;
      }

      await this.sendLeaveEmail({
        to: leaveRequest.approver.email,
        recipientName: leaveRequest.approver.name,
        subject: `[OfficeFlow] Leave request #${leaveRequest.id} requires review`,
        heading: 'Leave request awaiting review',
        message: `${leaveRequest.requester.name} submitted a leave request for your review.`,
        leaveRequestId: leaveRequest.id,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        actionLabel: 'Review leave request',
      });
    } catch (error: unknown) {
      this.logError('leave-requested', error);
      throw error;
    }
  }

  @OnEvent('leave.approved', { suppressErrors: false })
  async handleApproved(event: LeaveApprovedEvent) {
    await this.handleDecision(
      event.leaveRequestId,
      LeaveStatus.APPROVED,
      'approved',
    );
  }

  @OnEvent('leave.rejected', { suppressErrors: false })
  async handleRejected(event: LeaveRejectedEvent) {
    await this.handleDecision(
      event.leaveRequestId,
      LeaveStatus.REJECTED,
      'rejected',
    );
  }

  @OnEvent('leave.cancelled', { suppressErrors: false })
  async handleCancelled(event: LeaveCancelledEvent) {
    if (!this.mailService.isEnabled()) return;

    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: event.leaveRequestId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          requester: { select: { name: true } },
          approver: {
            select: { name: true, email: true, isActive: true },
          },
        },
      });

      if (
        !leaveRequest ||
        leaveRequest.status !== LeaveStatus.CANCELLED ||
        !leaveRequest.approver.email ||
        !leaveRequest.approver.isActive
      ) {
        this.logger.warn(
          `Cannot send leave-cancelled email for leave request ${event.leaveRequestId}`,
        );
        return;
      }

      await this.sendLeaveEmail({
        to: leaveRequest.approver.email,
        recipientName: leaveRequest.approver.name,
        subject: `[OfficeFlow] Leave request #${leaveRequest.id} was cancelled`,
        heading: 'Leave request cancelled',
        message: `${leaveRequest.requester.name} cancelled this pending leave request.`,
        leaveRequestId: leaveRequest.id,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        actionLabel: 'View leave request',
      });
    } catch (error: unknown) {
      this.logError('leave-cancelled', error);
      throw error;
    }
  }

  private async handleDecision(
    leaveRequestId: number,
    expectedStatus: typeof LeaveStatus.APPROVED | typeof LeaveStatus.REJECTED,
    decision: 'approved' | 'rejected',
  ) {
    if (!this.mailService.isEnabled()) return;

    try {
      const leaveRequest = await this.prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          requester: {
            select: { name: true, email: true, isActive: true },
          },
        },
      });

      if (
        !leaveRequest ||
        leaveRequest.status !== expectedStatus ||
        !leaveRequest.requester.email ||
        !leaveRequest.requester.isActive
      ) {
        this.logger.warn(
          `Cannot send leave-${decision} email for leave request ${leaveRequestId}`,
        );
        return;
      }

      await this.sendLeaveEmail({
        to: leaveRequest.requester.email,
        recipientName: leaveRequest.requester.name,
        subject: `[OfficeFlow] Leave request #${leaveRequest.id} was ${decision}`,
        heading: `Leave request ${decision}`,
        message: `Your leave request was ${decision}. Open OfficeFlow to review the decision.`,
        leaveRequestId: leaveRequest.id,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        actionLabel: 'View leave request',
      });
    } catch (error: unknown) {
      this.logError(`leave-${decision}`, error);
      throw error;
    }
  }

  private async sendLeaveEmail(params: {
    to: string;
    recipientName: string;
    subject: string;
    heading: string;
    message: string;
    leaveRequestId: number;
    startDate: Date;
    endDate: Date;
    actionLabel: string;
  }) {
    const email = leaveRequestEmailTemplate({
      recipientName: params.recipientName || 'User',
      subject: params.subject,
      heading: params.heading,
      message: params.message,
      leaveRequestId: params.leaveRequestId,
      startDate: formatDateOnly(params.startDate),
      endDate: formatDateOnly(params.endDate),
      leaveRequestUrl: this.getFrontendUrl(
        `/leave-requests/${params.leaveRequestId}`,
      ),
      actionLabel: params.actionLabel,
    });

    await this.mailService.sendEmail({
      to: params.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  private getFrontendUrl(path: string) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    return `${frontendUrl}${path}`;
  }

  private logError(eventName: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown email error';
    const stack = error instanceof Error ? error.stack : undefined;

    this.logger.error(`Failed to send ${eventName} email: ${message}`, stack);
  }
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
