import { TicketStatus } from '@prisma/client';

export class TicketStatusChangedEvent {
  constructor(
    public readonly ticketId: number,
    public readonly ticketTitle: string,
    public readonly changedById: number,
    public readonly changedByName: string,
    public readonly oldStatus: TicketStatus,
    public readonly newStatus: TicketStatus,
    public readonly recipientIds: number[],
  ) {}
}
