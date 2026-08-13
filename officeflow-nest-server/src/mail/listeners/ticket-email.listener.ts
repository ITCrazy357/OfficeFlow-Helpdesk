import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { TicketAssignedEvent } from '../../notifications/events/ticket-assigned.event';
import { TicketCreatedEvent } from '../../notifications/events/ticket-created.event';
import { TicketOverdueEvent } from '../../notifications/events/ticket-overdue.event';
import { TicketResolvedEvent } from '../../notifications/events/ticket-resolved.event';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail.service';
import { ticketAssignedEmailTemplate } from '../templates/ticket-assigned-email.template';
import { ticketCreatedEmailTemplate } from '../templates/ticket-created-email.template';
import { ticketOverdueEmailTemplate } from '../templates/ticket-overdue-email.template';
import { ticketResolvedEmailTemplate } from '../templates/ticket-resolved-email.template';

@Injectable()
export class TicketEmailListener {
  private readonly logger = new Logger(TicketEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('ticket.created', {
    async: true,
    suppressErrors: true,
  })
  async handleTicketCreated(event: TicketCreatedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: {
          id: event.ticketId,
        },
        select: {
          id: true,
          title: true,
          createdBy: {
            select: {
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      if (!ticket) {
        this.logger.warn(
          `Cannot send created email: ticket ${event.ticketId} was not found`,
        );

        return;
      }

      if (!ticket.createdBy.email || !ticket.createdBy.isActive) {
        this.logger.warn(
          'Cannot send created email: requester has no active email',
        );

        return;
      }

      const email = ticketCreatedEmailTemplate({
        requesterName: ticket.createdBy.name || 'User',
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        ticketUrl: this.getFrontendUrl(`/tickets/${ticket.id}`),
      });

      await this.mailService.sendEmail({
        to: ticket.createdBy.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('ticket-created', error);
    }
  }

  @OnEvent('ticket.assigned', {
    async: true,
    suppressErrors: true,
  })
  async handleTicketAssigned(event: TicketAssignedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const assignedTo = await this.prisma.user.findUnique({
        where: {
          id: event.assignedToId,
        },
        select: {
          name: true,
          email: true,
          isActive: true,
        },
      });

      if (!assignedTo?.email || !assignedTo.isActive) {
        this.logger.warn(
          `Cannot send assigned email: assignee ${event.assignedToId} has no active email`,
        );

        return;
      }

      const email = ticketAssignedEmailTemplate({
        assigneeName: assignedTo.name || 'User',
        ticketId: event.ticketId,
        ticketTitle: event.ticketTitle,
        assignedByName: event.assignedByName,
        ticketUrl: this.getFrontendUrl(`/tickets/${event.ticketId}`),
      });

      await this.mailService.sendEmail({
        to: assignedTo.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('ticket-assigned', error);
    }
  }

  @OnEvent('ticket.resolved', {
    async: true,
    suppressErrors: true,
  })
  async handleTicketResolved(event: TicketResolvedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: {
          id: event.ticketId,
        },
        select: {
          id: true,
          title: true,
          createdBy: {
            select: {
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      if (!ticket) {
        this.logger.warn(
          `Cannot send resolved email: ticket ${event.ticketId} was not found`,
        );

        return;
      }

      if (!ticket.createdBy.email || !ticket.createdBy.isActive) {
        this.logger.warn(
          'Cannot send resolved email: requester has no active email',
        );

        return;
      }

      const email = ticketResolvedEmailTemplate({
        requesterName: ticket.createdBy.name || 'User',
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        ticketUrl: this.getFrontendUrl(`/tickets/${ticket.id}`),
        resolvedByName: event.resolverName,
      });

      await this.mailService.sendEmail({
        to: ticket.createdBy.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error: unknown) {
      this.logError('ticket-resolved', error);
    }
  }

  @OnEvent('ticket.overdue', {
    async: true,
    suppressErrors: true,
  })
  async handleTicketOverdue(event: TicketOverdueEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const recipientIds = [...new Set(event.recipientIds)];

      if (recipientIds.length === 0) {
        return;
      }

      const recipients = await this.prisma.user.findMany({
        where: {
          id: {
            in: recipientIds,
          },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      for (const recipient of recipients) {
        const email = ticketOverdueEmailTemplate({
          recipientName: recipient.name || 'User',
          ticketId: event.ticketId,
          ticketTitle: event.ticketTitle,
          ticketUrl: this.getFrontendUrl(`/tickets/${event.ticketId}`),
        });

        try {
          await this.mailService.sendEmail({
            to: recipient.email,
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
        } catch (error: unknown) {
          this.logError(`ticket-overdue recipient ${recipient.id}`, error);
        }
      }
    } catch (error: unknown) {
      this.logError('ticket-overdue', error);
    }
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
