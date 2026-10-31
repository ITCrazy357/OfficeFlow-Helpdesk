import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuditLogAction,
  AuditLogEntity,
  Prisma,
  TicketHistoryAction,
  TicketStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  DashboardCacheInvalidatedEvent,
} from '../dashboard/events/dashboard-cache-invalidated.event';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmTicketDto,
  RateTicketDto,
  ReopenTicketDto,
} from './dto/ticket-feedback.dto';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { createTicketHistory } from './ticket-history.util';

const feedbackSelect = {
  score: true,
  comment: true,
  createdAt: true,
} satisfies Prisma.TicketFeedbackSelect;

@Injectable()
export class TicketFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TicketAccessPolicyService,
    private readonly audit: AuditLogsService,
    private readonly outbox: OutboxService,
    private readonly events: EventEmitter2,
  ) {}

  async get(ticketId: number, actor: CurrentUserPayload) {
    return runSerializableTransaction(this.prisma, async (transaction) => {
      await this.access.canAccessTicket(ticketId, actor, transaction);
      return transaction.ticketFeedback.findUnique({
        where: { ticketId },
        select: feedbackSelect,
      });
    });
  }

  private async respond(
    ticketId: number,
    dto: ConfirmTicketDto,
    actor: CurrentUserPayload,
    reason?: string,
  ) {
    const status = reason ? TicketStatus.IN_PROGRESS : TicketStatus.CLOSED;
    const result = await runSerializableTransaction(this.prisma, async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          title: true,
          status: true,
          createdById: true,
          assignedToId: true,
          resolutionVersion: true,
        },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');
      if (ticket.createdById !== actor.userId)
        throw new ForbiddenException(
          'Only the requester can confirm the ticket result',
        );
      if (
        ticket.status !== TicketStatus.RESOLVED ||
        ticket.resolutionVersion !== dto.resolutionVersion
      )
        throw new ConflictException(
          'Ticket result changed. Reload before responding',
        );

      const changed = await tx.ticket.updateMany({
        where: {
          id: ticketId,
          status: TicketStatus.RESOLVED,
          resolutionVersion: dto.resolutionVersion,
        },
        data: {
          status,
          confirmedAt: reason ? null : new Date(),
          ...(reason ? { resolveAt: null } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Ticket result changed. Reload before responding',
        );
      await createTicketHistory(tx, {
        ticketId,
        userId: actor.userId,
        action: TicketHistoryAction.STATUS_CHANGED,
        oldValue: TicketStatus.RESOLVED,
        newValue: status,
      });
      if (reason) {
        await tx.ticketComment.create({
          data: {
            ticketId,
            authorId: actor.userId,
            content: `Yêu cầu xử lý tiếp: ${reason}`,
          },
        });
        await createTicketHistory(tx, {
          ticketId,
          userId: actor.userId,
          action: TicketHistoryAction.COMMENTED,
          newValue: reason,
        });
      }
      await this.audit.create(
        {
          actorId: actor.userId,
          entity: AuditLogEntity.TICKET,
          entityId: ticketId,
          action: AuditLogAction.STATUS_CHANGED,
          description: reason
            ? 'Requester asked for further support.'
            : 'Requester confirmed the ticket result.',
          oldValues: { status: ticket.status },
          newValues: {
            status,
            resolutionVersion: ticket.resolutionVersion,
            ...(reason ? { reason } : {}),
          },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        },
        tx,
      );
      const requester = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { name: true },
      });
      await this.outbox.enqueue(tx, {
        type: OUTBOX_EVENT_TYPES.TICKET_STATUS_CHANGED,
        payload: {
          ticketId,
          ticketTitle: ticket.title,
          changedById: actor.userId,
          changedByName: requester?.name ?? 'Người gửi',
          oldStatus: ticket.status,
          newStatus: status,
          recipientIds: [
            ...new Set(
              [ticket.createdById, ticket.assignedToId].filter(
                (id): id is number => id !== null,
              ),
            ),
          ],
        },
      });
      return { id: ticketId, status };
    });
    await this.events.emitAsync(
      DASHBOARD_CACHE_INVALIDATE_EVENT,
      new DashboardCacheInvalidatedEvent('TICKET_STATUS_CHANGED', ticketId),
    );
    return result;
  }

  confirm(ticketId: number, dto: ConfirmTicketDto, actor: CurrentUserPayload) {
    return this.respond(ticketId, dto, actor);
  }

  async reopen(
    ticketId: number,
    dto: ReopenTicketDto,
    actor: CurrentUserPayload,
  ) {
    const reason = dto.reason.trim();
    if (reason.length < 5 || reason.length > 2000)
      throw new BadRequestException(
        'A reason of 5 to 2000 characters is required',
      );
    return this.respond(ticketId, dto, actor, reason);
  }

  async rate(ticketId: number, dto: RateTicketDto, actor: CurrentUserPayload) {
    const comment = dto.comment?.trim() || null;
    if (
      !Number.isInteger(dto.score) ||
      dto.score < 1 ||
      dto.score > 5 ||
      (dto.score <= 2 && (!comment || comment.length < 5))
    )
      throw new BadRequestException(
        'Ratings of 1 or 2 require a reason of at least 5 characters',
      );
    try {
      return await runSerializableTransaction(this.prisma, async (tx) => {
        const ticket = await tx.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            createdById: true,
            assignedToId: true,
            resolutionVersion: true,
          },
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        if (ticket.createdById !== actor.userId)
          throw new ForbiddenException(
            'Only the requester can rate the ticket',
          );
        if (ticket.status !== TicketStatus.CLOSED)
          throw new ConflictException(
            'Confirm the ticket result before rating',
          );
        if (
          await tx.ticketFeedback.findUnique({
            where: { ticketId },
            select: { ticketId: true },
          })
        )
          throw new ConflictException('This ticket has already been rated');
        const feedback = await tx.ticketFeedback.create({
          data: {
            ticketId,
            authorId: actor.userId,
            assignedToId: ticket.assignedToId,
            score: dto.score,
            comment,
            resolutionVersion: ticket.resolutionVersion,
          },
          select: feedbackSelect,
        });
        await this.audit.create(
          {
            actorId: actor.userId,
            entity: AuditLogEntity.TICKET,
            entityId: ticketId,
            action: AuditLogAction.UPDATE,
            description: 'Requester rated support.',
            newValues: { score: dto.score, comment },
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
          tx,
        );
        return feedback;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('This ticket has already been rated');
      throw error;
    }
  }
}
