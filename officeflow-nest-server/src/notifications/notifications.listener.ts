import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import type { OutboxDispatchedEvent } from '../outbox/outbox.constants';
import { NotificationsService } from './notifications.service';
import { AssetAssignedEvent } from './events/asset-assigned.event';
import { AssetReturnedEvent } from './events/asset-returned.event';
import { TicketAssignedEvent } from './events/ticket-assigned.event';
import { TicketCommentedEvent } from './events/ticket-commented.event';
import { TicketOverdueEvent } from './events/ticket-overdue.event';
import { TicketStatusChangedEvent } from './events/ticket-status-changed.event';

@Injectable()
export class NotificationsListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('ticket.assigned', { suppressErrors: false })
  async handleTicketAssignedEvent(
    event: TicketAssignedEvent & OutboxDispatchedEvent,
  ) {
    await this.notificationsService.create({
      userId: event.assignedToId,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'New ticket assigned',
      message: `${event.assignedByName} assigned ticket "${event.ticketTitle}" to you`,
      targetUrl: `/tickets/${event.ticketId}`,
      sourceEventId: event.outboxEventId,
    });
  }

  @OnEvent('ticket.commented', { suppressErrors: false })
  async handleTicketCommentedEvent(
    event: TicketCommentedEvent & OutboxDispatchedEvent,
  ) {
    const recipientIds = event.recipientIds.filter(
      (id) => id !== event.commentAuthorId,
    );

    await this.notificationsService.createdMany({
      userIds: recipientIds,
      type: NotificationType.TICKET_COMMENTED,
      title: 'New ticket comment',
      message: `${event.commentAuthorName} commented on ticket "${event.ticketTitle}"`,
      targetUrl: `/tickets/${event.ticketId}`,
      sourceEventId: event.outboxEventId,
    });
  }

  @OnEvent('ticket.status_changed', { suppressErrors: false })
  async handleTicketStatusChangedEvent(
    event: TicketStatusChangedEvent & OutboxDispatchedEvent,
  ) {
    const recipientIds = event.recipientIds.filter(
      (id) => id !== event.changedById,
    );

    await this.notificationsService.createdMany({
      userIds: recipientIds,
      type: NotificationType.TICKET_STATUS_CHANGED,
      title: 'Ticket status changed',
      message: `${event.changedByName} changed ticket "${event.ticketTitle}" status from "${event.oldStatus}" to "${event.newStatus}"`,
      targetUrl: `/tickets/${event.ticketId}`,
      sourceEventId: event.outboxEventId,
    });
  }

  @OnEvent('ticket.overdue', { suppressErrors: false })
  async handleTicketOverdueEvent(
    event: TicketOverdueEvent & OutboxDispatchedEvent,
  ) {
    await this.notificationsService.createdMany({
      userIds: event.recipientIds,
      type: NotificationType.TICKET_OVERDUE,
      title: 'Ticket overdue',
      message: `Ticket "${event.ticketTitle}" has passed its SLA deadline`,
      targetUrl: `/tickets/${event.ticketId}`,
      sourceEventId: event.outboxEventId,
    });
  }

  @OnEvent('asset.assigned', { suppressErrors: false })
  async handleAssetAssignedEvent(
    event: AssetAssignedEvent & OutboxDispatchedEvent,
  ) {
    await this.notificationsService.create({
      userId: event.assignedToId,
      type: NotificationType.ASSET_ASSIGNED,
      title: 'Asset assigned to you',
      message:
        `${event.assignedByName} assigned ` +
        `${event.assetName} (${event.assetTag}) to you.`,
      targetUrl: `/assets/${event.assetId}`,
      sourceEventId: event.outboxEventId,
    });
  }

  @OnEvent('asset.returned', { suppressErrors: false })
  async handleAssetReturnedEvent(
    event: AssetReturnedEvent & OutboxDispatchedEvent,
  ) {
    await this.notificationsService.create({
      userId: event.previousAssignedToId,
      type: NotificationType.ASSET_RETURNED,
      title: 'Asset returned',
      message:
        `${event.returnedByName} recorded the return of ` +
        `${event.assetName} (${event.assetTag}).`,
      targetUrl: '/assets',
      sourceEventId: event.outboxEventId,
    });
  }
}
