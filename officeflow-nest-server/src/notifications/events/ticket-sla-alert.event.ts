import type {
  OutboxDispatchedEvent,
  OutboxEventPayloadByType,
  OUTBOX_EVENT_TYPES,
} from '../../outbox/outbox.constants';

export type TicketSlaAlertEvent =
  OutboxEventPayloadByType[typeof OUTBOX_EVENT_TYPES.TICKET_SLA_ALERT] &
    OutboxDispatchedEvent;

export function formatSlaDeadline(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
