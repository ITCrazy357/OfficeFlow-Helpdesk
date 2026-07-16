import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { DbHealthDepartment, HealthStatus } from "./types";

export async function getHealthApi() {
  const res = await api.get<ApiResponse<HealthStatus>>("/health");
  return res.data.data;
}

export async function getDbHealthApi() {
  const res = await api.get<ApiResponse<DbHealthDepartment[]>>("/db-health");
  return res.data.data;
}
