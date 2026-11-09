import type { AuthUser } from "@/features/auth/types";
import type { Ticket } from "./types";

export function canEditTicket(user: AuthUser | undefined, ticket: Ticket) {
  if (!user) {
    return false;
  }

  if (user.role === "EMPLOYEE") {
    return ticket.createdBy?.id === user.id && ticket.status === "OPEN";
  }

  if (user.role === "IT_STAFF") {
    return !ticket.assignedTo || ticket.assignedTo.id === user.id;
  }

  if (user.role === "MANAGER") {
    const departmentId = user.departmentId ?? user.department?.id;
    return Boolean(
      departmentId && ticket.createdBy?.departmentId === departmentId,
    );
  }

  return true;
}

export function canChangeStatus(user: AuthUser | undefined) {
  return user?.role === "ADMIN" || user?.role === "IT_STAFF";
}

export function canUseDiscussion(user: AuthUser | undefined, ticket?: Ticket) {
  if (!user) {
    return false;
  }

  return (
    user.role === "ADMIN" ||
    user.role === "IT_STAFF" ||
    user.role === "MANAGER" ||
    (user.role === "EMPLOYEE" && ticket?.createdBy?.id === user.id)
  );
}

export function canDeleteTicket(user: AuthUser | undefined, ticket: Ticket) {
  if (!user) {
    return false;
  }

  return (
    user.role === "ADMIN" ||
    (user.role === "EMPLOYEE" &&
      ticket.createdBy?.id === user.id &&
      ticket.status === "OPEN")
  );
}
