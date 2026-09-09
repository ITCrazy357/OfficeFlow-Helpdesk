import type { TicketStatus } from "./types";

// Mirrors the backend policy; the server still authorizes every transition.
const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransitionTicket(from: TicketStatus, to: TicketStatus) {
  return from === to || transitions[from].includes(to);
}

export function isTerminalTicket(status: TicketStatus) {
  return transitions[status].length === 0;
}
