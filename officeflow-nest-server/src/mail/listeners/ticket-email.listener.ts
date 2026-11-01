import { Injectable, Logger } from '@nestjs/common';
import { getSafeErrorDetails } from '../../common/diagnostics/request-diagnostics';
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
import type { TicketSlaAlertEvent } from '../../notifications/events/ticket-sla-alert.event';
import { ticketSlaAlertEmailTemplate } from '../templates/ticket-sla-alert-email.template';
import { TicketAccessPolicyService } from '../../tickets/ticket-access-policy.service';
import { EmailDeliveryService } from '../email-delivery.service';
import type { OutboxDispatchedEvent } from '../../outbox/outbox.constants';

@Injectable()
export class TicketEmailListener {
  private readonly logger = new Logger(TicketEmailListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly ticketAccess: TicketAccessPolicyService,
    private readonly delivery: EmailDeliveryService,
  ) {}

  @OnEvent('ticket.sla_alert', { suppressErrors: false })
  async handleTicketSlaAlert(event: TicketSlaAlertEvent) {
    if (!this.mailService.isEnabled()) return;
    const failures: number[] = [];
    for (const id of new Set(event.recipientIds)) {
      const [recipient] = await this.ticketAccess.getRecipients(
        event.ticketId,
        [id],
      );
      if (!recipient) continue;
      const email = ticketSlaAlertEmailTemplate(
        event,
        recipient.name,
        this.getFrontendUrl(`/tickets/${event.ticketId}`),
      );
      try {
        await this.delivery.send(event.outboxEventId, recipient.id, () =>
          this.mailService.sendEmail({ to: recipient.email, ...email }),
        );
      } catch (error) {
        this.logError(`ticket-sla recipient ${recipient.id}`, error);
        failures.push(recipient.id);
      }
    }
    if (failures.length)
      throw new Error(`SLA email failed for recipients ${failures.join(',')}`);
  }

  @OnEvent('ticket.created', {
    suppressErrors: false,
  })
  async handleTicketCreated(event: TicketCreatedEvent & OutboxDispatchedEvent) {
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
              id: true,
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

      await this.delivery.send(event.outboxEventId, ticket.createdBy.id, () =>
        this.mailService.sendEmail({
          to: ticket.createdBy.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      );
    } catch (error: unknown) {
      this.logError('ticket-created', error);
      throw error;
    }
  }

  @OnEvent('ticket.assigned', {
    suppressErrors: false,
  })
  async handleTicketAssigned(
    event: TicketAssignedEvent & OutboxDispatchedEvent,
  ) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const [assignedTo] = await this.ticketAccess.getRecipients(
        event.ticketId,
        [event.assignedToId],
      );

      if (!assignedTo?.email) {
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

      await this.delivery.send(event.outboxEventId, assignedTo.id, () =>
        this.mailService.sendEmail({
          to: assignedTo.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      );
    } catch (error: unknown) {
      this.logError('ticket-assigned', error);
      throw error;
    }
  }

  @OnEvent('ticket.resolved', {
    suppressErrors: false,
  })
  async handleTicketResolved(
    event: TicketResolvedEvent & OutboxDispatchedEvent,
  ) {
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
              id: true,
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

      await this.delivery.send(event.outboxEventId, ticket.createdBy.id, () =>
        this.mailService.sendEmail({
          to: ticket.createdBy.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      );
    } catch (error: unknown) {
      this.logError('ticket-resolved', error);
      throw error;
    }
  }

  @OnEvent('ticket.overdue', {
    suppressErrors: false,
  })
  async handleTicketOverdue(event: TicketOverdueEvent & OutboxDispatchedEvent) {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      const recipientIds = [...new Set(event.recipientIds)];

      if (recipientIds.length === 0) {
        return;
      }

      const failedRecipientIds: number[] = [];

      for (const id of recipientIds) {
        const [recipient] = await this.ticketAccess.getRecipients(
          event.ticketId,
          [id],
        );
        if (!recipient) continue;
        const email = ticketOverdueEmailTemplate({
          recipientName: recipient.name || 'User',
          ticketId: event.ticketId,
          ticketTitle: event.ticketTitle,
          ticketUrl: this.getFrontendUrl(`/tickets/${event.ticketId}`),
        });

        try {
          await this.delivery.send(event.outboxEventId, recipient.id, () =>
            this.mailService.sendEmail({
              to: recipient.email,
              subject: email.subject,
              text: email.text,
              html: email.html,
            }),
          );
        } catch (error: unknown) {
          this.logError(`ticket-overdue recipient ${recipient.id}`, error);
          failedRecipientIds.push(recipient.id);
        }
      }

      if (failedRecipientIds.length > 0) {
        throw new Error(
          `Ticket-overdue email failed for recipients ${failedRecipientIds.join(',')}`,
        );
      }
    } catch (error: unknown) {
      this.logError('ticket-overdue', error);
      throw error;
    }
  }

  private getFrontendUrl(path: string) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    return `${frontendUrl}${path}`;
  }

  private logError(eventName: string, error: unknown) {
    this.logger.error({
      event: 'mail_listener_failed',
      operation: eventName,
      ...getSafeErrorDetails(error),
    });
  }
}
