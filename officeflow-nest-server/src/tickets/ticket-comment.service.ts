import { Injectable } from '@nestjs/common';
import { TicketHistoryAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { TicketAccessPolicyService } from './ticket-access-policy.service';
import { createTicketHistory } from './ticket-history.util';

@Injectable()
export class TicketCommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly access: TicketAccessPolicyService,
  ) {}
  async addComment(
    ticketId: number,
    createCommentDto: CreateTicketCommentDto,
    currentUser: CurrentUserPayload,
  ) {
    await this.access.canAccessTicket(ticketId, currentUser);

    const comment = await this.prisma.$transaction(async (transaction) => {
      const createdComment = await transaction.ticketComment.create({
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

      await createTicketHistory(transaction, {
        ticketId,
        userId: currentUser.userId,
        action: TicketHistoryAction.COMMENTED,
        newValue: createdComment.content,
      });

      const ticket = await transaction.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: {
          id: true,
          title: true,
          createdById: true,
          assignedToId: true,
        },
      });
      const recipientIds = [ticket.createdById, ticket.assignedToId].filter(
        (id): id is number => Boolean(id),
      );

      await this.outboxService.enqueue(transaction, {
        type: OUTBOX_EVENT_TYPES.TICKET_COMMENTED,
        payload: {
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          commentAuthorId: currentUser.userId,
          commentAuthorName: createdComment.author.name,
          recipientIds,
        },
      });

      return createdComment;
    });

    return comment;
  }

  // Lấy nội dung comment

  async getComments(ticketId: number, currentUser: CurrentUserPayload) {
    await this.access.canAccessTicket(ticketId, currentUser);

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
}
