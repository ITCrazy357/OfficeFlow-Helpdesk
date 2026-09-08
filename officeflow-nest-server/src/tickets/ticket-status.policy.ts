import { ConflictException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
  [TicketStatus.CANCELLED]: [],
};

export function assertTicketStatusTransition(
  currentStatus: TicketStatus,
  nextStatus: TicketStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new ConflictException(
      `Cannot change ticket status from ${currentStatus} to ${nextStatus}`,
    );
  }
}
