export class TicketResolvedEvent {
  constructor(
    public readonly ticketId: number,
    public readonly ticketTitle: string,
    public readonly resolverId: number,
    public readonly resolverName: string,
    public readonly recipientIds: number[],
  ) {}
}
