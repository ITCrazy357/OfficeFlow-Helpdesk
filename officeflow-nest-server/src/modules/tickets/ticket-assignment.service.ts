import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  type Prisma,
  TicketHistoryAction,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../../contracts/events/outbox-events';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { runSerializableTransaction } from '../../common/database/serializable-transaction.util';
import { assertTicketAssignee } from '../users/user-lifecycle.policy';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { BulkAssignTicketsDto } from './dto/bulk-assign-tickets.dto';
import { createTicketHistory } from './ticket-history.util';
import { ticketStatusSelect } from './ticket-select';

@Injectable()
export class TicketAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly outboxService: OutboxService,
  ) {}

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

        return this.applyAssignment(
          transaction,
          ticket,
          assignTicketDto.assignedToId,
          currentUser,
          actor.name,
        );
      },
    );

    return updatedTicket;
  }

  async bulkAssign(dto: BulkAssignTicketsDto, currentUser: CurrentUserPayload) {
    if (
      currentUser.role !== UserRole.ADMIN &&
      currentUser.role !== UserRole.IT_STAFF
    ) {
      throw new ForbiddenException('Forbidden');
    }

    return runSerializableTransaction(this.prisma, async (transaction) => {
      const tickets = await transaction.ticket.findMany({
        where: { id: { in: dto.ticketIds } },
        select: { id: true, title: true, status: true, assignedToId: true },
        orderBy: { id: 'asc' },
      });
      if (tickets.length !== dto.ticketIds.length) {
        throw new NotFoundException('One or more tickets no longer exist');
      }
      if (
        tickets.some(
          (ticket) =>
            ticket.status !== TicketStatus.OPEN &&
            ticket.status !== TicketStatus.IN_PROGRESS,
        )
      ) {
        throw new ConflictException(
          'Only OPEN or IN_PROGRESS tickets can be assigned in bulk',
        );
      }

      await assertTicketAssignee(transaction, dto.assignedToId);
      const actor = await transaction.user.findUnique({
        where: { id: currentUser.userId },
        select: { name: true },
      });
      if (!actor) throw new NotFoundException('Actor not found');

      let assignedCount = 0;
      for (const ticket of tickets) {
        if (ticket.assignedToId === dto.assignedToId) continue;
        await this.applyAssignment(
          transaction,
          ticket,
          dto.assignedToId,
          currentUser,
          actor.name,
        );
        assignedCount++;
      }
      return { assignedCount, unchangedCount: tickets.length - assignedCount };
    });
  }

  private async applyAssignment(
    transaction: Prisma.TransactionClient,
    ticket: { id: number; title: string; assignedToId: number | null },
    assignedToId: number,
    currentUser: CurrentUserPayload,
    actorName: string,
  ) {
    const id = ticket.id;
    const result = await transaction.ticket.update({
      where: { id },
      data: {
        assignedToId,
      },
      select: ticketStatusSelect,
    });

    await createTicketHistory(transaction, {
      ticketId: id,
      userId: currentUser.userId,
      action: TicketHistoryAction.ASSIGNED,
      oldValue: ticket.assignedToId ? String(ticket.assignedToId) : undefined,
      newValue: String(assignedToId),
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
          assignedToId,
        },
        ipAddress: currentUser.ipAddress,
        userAgent: currentUser.userAgent,
      },
      transaction,
    );

    if (ticket.assignedToId !== assignedToId) {
      await this.outboxService.enqueue(transaction, {
        type: OUTBOX_EVENT_TYPES.TICKET_ASSIGNED,
        payload: {
          ticketId: id,
          ticketTitle: ticket.title,
          assignedToId,
          assignedByName: actorName || 'Someone',
        },
      });
    }

    return result;
  }
}
