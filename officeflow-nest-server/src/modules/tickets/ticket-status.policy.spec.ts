import { ConflictException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { assertTicketStatusTransition } from './ticket-status.policy';

describe('Ticket status policy', () => {
  it('allows starting an open ticket', () => {
    expect(() =>
      assertTicketStatusTransition(TicketStatus.OPEN, TicketStatus.IN_PROGRESS),
    ).not.toThrow();
  });

  it('reject closing an open ticket directly', () => {
    expect(() =>
      assertTicketStatusTransition(TicketStatus.OPEN, TicketStatus.CLOSED),
    ).toThrow(ConflictException);
  });

  it('allows repeating the current status', () => {
    expect(() =>
      assertTicketStatusTransition(TicketStatus.CLOSED, TicketStatus.CLOSED),
    ).not.toThrow();
  });

  it.each([
    [TicketStatus.OPEN, TicketStatus.CANCELLED],
    [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
    [TicketStatus.RESOLVED, TicketStatus.CLOSED],
    [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS],
  ])('allows %s -> %s', (currentStatus, nextStatus) => {
    expect(() =>
      assertTicketStatusTransition(currentStatus, nextStatus),
    ).not.toThrow();
  });

  it.each([
    [TicketStatus.OPEN, TicketStatus.RESOLVED],
    [TicketStatus.IN_PROGRESS, TicketStatus.OPEN],
    [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
    [TicketStatus.RESOLVED, TicketStatus.OPEN],
    [TicketStatus.RESOLVED, TicketStatus.CANCELLED],
    [TicketStatus.CLOSED, TicketStatus.OPEN],
    [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
    [TicketStatus.CLOSED, TicketStatus.RESOLVED],
    [TicketStatus.CLOSED, TicketStatus.CANCELLED],
    [TicketStatus.CANCELLED, TicketStatus.OPEN],
    [TicketStatus.CANCELLED, TicketStatus.IN_PROGRESS],
    [TicketStatus.CANCELLED, TicketStatus.RESOLVED],
    [TicketStatus.CANCELLED, TicketStatus.CLOSED],
  ])('rejects %s -> %s', (currentStatus, nextStatus) => {
    expect(() =>
      assertTicketStatusTransition(currentStatus, nextStatus),
    ).toThrow(ConflictException);
  });

  it.each([
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CANCELLED,
  ])('allows repeating %s', (status) => {
    expect(() => assertTicketStatusTransition(status, status)).not.toThrow();
  });
});
