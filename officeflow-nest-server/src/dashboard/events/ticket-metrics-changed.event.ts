export class TicketMetricsChangedEvent {
  constructor(
    public readonly ticketId: number,
    public readonly reason:
      'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'DELETED' | 'OVERDUE',
  ) {}
}
