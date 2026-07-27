import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

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

  @OnEvent('ticket.assigned')
  async handleTicketAssignedEvent(event: TicketAssignedEvent) {
    await this.notificationsService.create({
      userId: event.assignedToId,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'New ticket assigned',
      message: `${event.assignedByName} assigned ticket "${event.ticketTitle}" to you`,
      targetUrl: `/tickets/${event.ticketId}`,
    });
  }

  @OnEvent('ticket.commented')
  async handleTicketCommentedEvent(event: TicketCommentedEvent) {
    const recipientIds = event.recipientIds.filter(
      (id) => id !== event.commentAuthorId,
    );

    await this.notificationsService.createdMany({
      userIds: recipientIds,
      type: NotificationType.TICKET_COMMENTED,
      title: 'New ticket comment',
      message: `${event.commentAuthorName} commented on ticket "${event.ticketTitle}"`,
      targetUrl: `/tickets/${event.ticketId}`,
    });
  }

  @OnEvent('ticket.status_changed')
  async handleTicketStatusChangedEvent(event: TicketStatusChangedEvent) {
    const recipientIds = event.recipientIds.filter(
      (id) => id !== event.changedById,
    );

    await this.notificationsService.createdMany({
      userIds: recipientIds,
      type: NotificationType.TICKET_STATUS_CHANGED,
      title: 'Ticket status changed',
      message: `${event.changedByName} changed ticket "${event.ticketTitle}" status from "${event.oldStatus}" to "${event.newStatus}"`,
      targetUrl: `/tickets/${event.ticketId}`,
    });
  }

  @OnEvent('ticket.overdue')
  async handleTicketOverdueEvent(event: TicketOverdueEvent) {
    await this.notificationsService.createdMany({
      userIds: event.recipientIds,
      type: NotificationType.TICKET_OVERDUE,
      title: 'Ticket overdue',
      message: `Ticket "${event.ticketTitle}" has passed its SLA deadline`,
      targetUrl: `/tickets/${event.ticketId}`,
    });
  }

  @OnEvent('asset.assigned')
  async handleAssetAssignedEvent(event: AssetAssignedEvent) {
    await this.notificationsService.create({
      userId: event.assignedToId,
      type: NotificationType.ASSET_ASSIGNED,
      title: 'Asset assigned to you',
      message:
        `${event.assignedByName} assigned ` +
        `${event.assetName} (${event.assetTag}) to you.`,
      targetUrl: `/assets/${event.assetId}`,
    });
  }

  @OnEvent('asset.returned')
  async handleAssetReturnedEvent(event: AssetReturnedEvent) {
    await this.notificationsService.create({
      userId: event.previousAssignedToId,
      type: NotificationType.ASSET_RETURNED,
      title: 'Asset returned',
      message:
        `${event.returnedByName} recorded the return of ` +
        `${event.assetName} (${event.assetTag}).`,
      targetUrl: '/assets',
    });
  }
}
