export class TicketCommentedEvent {
  constructor(
    public readonly ticketId: number,
    public readonly ticketTitle: string,
    public readonly commentAuthorId: number,
    public readonly commentAuthorName: string,
    public readonly recipientIds: number[],
  ) {}
}
