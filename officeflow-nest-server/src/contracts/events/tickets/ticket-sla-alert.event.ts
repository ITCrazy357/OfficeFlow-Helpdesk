import type {
  OutboxDispatchedEvent,
  OutboxEventPayloadByType,
  OUTBOX_EVENT_TYPES,
} from '../outbox-events';

export type TicketSlaAlertEvent =
  OutboxEventPayloadByType[typeof OUTBOX_EVENT_TYPES.TICKET_SLA_ALERT] &
    OutboxDispatchedEvent;
