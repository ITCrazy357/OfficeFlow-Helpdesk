import type { UserRole } from "@/features/auth/types";
import type { PaginatedData } from "@/types/api";

export type AuditLogEntity =
  | "USER"
  | "DEPARTMENT"
  | "TICKET"
  | "KNOWLEDGE_ARTICLE"
  | "ASSET";

export type AuditLogAction =
  | "CREATE"
  | "UPDATE"
  | "DELETED"
  | "ASSIGNED"
  | "RETURNED"
  | "STATUS_CHANGED"
  | "ACTIVATED"
  | "DEACTIVATED"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "LINKED"
  | "UNLINKED";

export type AuditLogActor = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type AuditLog = {
  id: number;
  actorId?: number | null;
  actor?: AuditLogActor | null;
  entity: AuditLogEntity;
  entityId?: number | null;
  action: AuditLogAction;
  description: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export type GetAuditLogsParams = {
  page?: number;
  limit?: number;
  entity?: AuditLogEntity;
  action?: AuditLogAction;
  actorId?: number;
  entityId?: number;
  keyword?: string;
  from?: string;
  to?: string;
};

export type AuditLogsList = PaginatedData<AuditLog>;
