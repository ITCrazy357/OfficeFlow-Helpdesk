import { type Prisma, TicketHistoryAction } from '@prisma/client';

export function createTicketHistory(
  database: Prisma.TransactionClient,
  params: {
    ticketId: number;
    userId: number;
    action: TicketHistoryAction;
    oldValue?: string;
    newValue?: string;
  },
) {
  return database.ticketHistory.create({
    data: {
      ...params,
      oldValue: params.oldValue?.slice(0, 191),
      newValue: params.newValue?.slice(0, 191),
    },
  });
}
