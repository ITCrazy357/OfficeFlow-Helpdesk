import { TicketPriority } from '@prisma/client';

export function calculateDueAt(priority?: TicketPriority) {
  const now = new Date();

  const dueAt = new Date(now);

  switch (priority || TicketPriority.MEDIUM) {
    case TicketPriority.URGENT:
      dueAt.setHours(dueAt.getHours() + 4);
      break;

    case TicketPriority.HIGH:
      dueAt.setDate(dueAt.getDate() + 1);
      break;

    case TicketPriority.MEDIUM:
      dueAt.setDate(dueAt.getDate() + 3);
      break;

    case TicketPriority.LOW:
      dueAt.setDate(dueAt.getDate() + 7);
      break;

    default:
      dueAt.setDate(dueAt.getDate() + 3);
      break;
  }

  return dueAt;
}
