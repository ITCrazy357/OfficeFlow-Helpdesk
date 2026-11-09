export class TicketOverdueEvent {
  constructor(
    public readonly ticketId: number,
    public readonly ticketTitle: string,
    public readonly recipientIds: number[],
  ) {}
}
