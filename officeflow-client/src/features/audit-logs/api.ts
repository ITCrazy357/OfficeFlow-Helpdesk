import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  AuditLog,
  AuditLogsList,
  GetAuditLogsParams,
} from "./types";

export async function getAuditLogsApi(params: GetAuditLogsParams = {}) {
  const response = await api.get<ApiResponse<AuditLogsList>>("/audit-logs", {
    params,
  });

  return response.data.data;
}

export async function getAuditLogApi(id: number) {
  const response = await api.get<ApiResponse<AuditLog>>(`/audit-logs/${id}`);

  return response.data.data;
}
