export class TicketAssignedEvent {
  constructor(
    public readonly ticketId: number,
    public readonly ticketTitle: string,
    public readonly assignedToId: number,
    public readonly assignedByName: string,
  ) {}
}
