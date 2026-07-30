import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAuditLogApi, getAuditLogsApi } from "./api";
import type { GetAuditLogsParams } from "./types";

export const auditLogQueryKeys = {
  all: ["audit-logs"] as const,
  list: (params: GetAuditLogsParams) =>
    [...auditLogQueryKeys.all, "list", params] as const,
  detail: (id: number) => [...auditLogQueryKeys.all, "detail", id] as const,
};

export function useAuditLogs(
  params: GetAuditLogsParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: auditLogQueryKeys.list(params),
    queryFn: () => getAuditLogsApi(params),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAuditLog(id: number, enabled = true) {
  return useQuery({
    queryKey: auditLogQueryKeys.detail(id),
    queryFn: () => getAuditLogApi(id),
    enabled,
    retry: false,
  });
}
