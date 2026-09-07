import type { TicketStatus } from '@prisma/client';

export const OUTBOX_EVENT_TYPES = {
  TICKET_CREATED: 'ticket.created',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_COMMENTED: 'ticket.commented',
  TICKET_STATUS_CHANGED: 'ticket.status_changed',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_OVERDUE: 'ticket.overdue',
  ASSET_ASSIGNED: 'asset.assigned',
  ASSET_RETURNED: 'asset.returned',
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_CANCELLED: 'leave.cancelled',
  USER_CREATED: 'user.created',
  USER_PASSWORD_RESET: 'user.password-reset',
  PASSWORD_RECOVERY_COMPLETED: 'password-recovery.completed',
  CLOUDINARY_ASSET_DELETE: 'cloudinary.asset.delete',
} as const;

export type OutboxEventType =
  (typeof OUTBOX_EVENT_TYPES)[keyof typeof OUTBOX_EVENT_TYPES];

export type OutboxEventPayloadByType = {
  [OUTBOX_EVENT_TYPES.TICKET_CREATED]: {
    ticketId: number;
  };
  [OUTBOX_EVENT_TYPES.TICKET_ASSIGNED]: {
    ticketId: number;
    ticketTitle: string;
    assignedToId: number;
    assignedByName: string;
  };
  [OUTBOX_EVENT_TYPES.TICKET_COMMENTED]: {
    ticketId: number;
    ticketTitle: string;
    commentAuthorId: number;
    commentAuthorName: string;
    recipientIds: number[];
  };
  [OUTBOX_EVENT_TYPES.TICKET_STATUS_CHANGED]: {
    ticketId: number;
    ticketTitle: string;
    changedById: number;
    changedByName: string;
    oldStatus: TicketStatus;
    newStatus: TicketStatus;
    recipientIds: number[];
  };
  [OUTBOX_EVENT_TYPES.TICKET_RESOLVED]: {
    ticketId: number;
    ticketTitle: string;
    resolverId: number;
    resolverName: string;
    recipientIds: number[];
  };
  [OUTBOX_EVENT_TYPES.TICKET_OVERDUE]: {
    ticketId: number;
    ticketTitle: string;
    recipientIds: number[];
  };
  [OUTBOX_EVENT_TYPES.ASSET_ASSIGNED]: {
    assetId: number;
    assetTag: string;
    assetName: string;
    assignedToId: number;
    assignedByName: string;
  };
  [OUTBOX_EVENT_TYPES.ASSET_RETURNED]: {
    assetId: number;
    assetTag: string;
    assetName: string;
    previousAssignedToId: number;
    returnedByName: string;
  };
  [OUTBOX_EVENT_TYPES.LEAVE_REQUESTED]: {
    leaveRequestId: number;
  };
  [OUTBOX_EVENT_TYPES.LEAVE_APPROVED]: {
    leaveRequestId: number;
  };
  [OUTBOX_EVENT_TYPES.LEAVE_REJECTED]: {
    leaveRequestId: number;
  };
  [OUTBOX_EVENT_TYPES.LEAVE_CANCELLED]: {
    leaveRequestId: number;
  };
  [OUTBOX_EVENT_TYPES.USER_CREATED]: {
    userId: number;
  };
  [OUTBOX_EVENT_TYPES.USER_PASSWORD_RESET]: {
    userId: number;
  };
  [OUTBOX_EVENT_TYPES.PASSWORD_RECOVERY_COMPLETED]: {
    userId: number;
  };
  [OUTBOX_EVENT_TYPES.CLOUDINARY_ASSET_DELETE]: {
    publicId: string;
    resourceType: 'image' | 'raw' | 'video';
    deliveryType: 'upload' | 'private' | 'authenticated';
  };
};

export type OutboxDispatchedEvent = {
  outboxEventId?: string;
};
