import { api } from "@/lib/axios";
import type { HealthStatus } from "./types";

type HealthResponse = {
  success: boolean;
  message: string;
};

function toHealthStatus(response: HealthResponse) {
  return {
    ok: response.success,
    message: response.message,
  } satisfies HealthStatus;
}

export async function getHealthApi() {
  const res = await api.get<HealthResponse>("/health");

  return toHealthStatus(res.data);
}

export async function getDbHealthApi() {
  try {
    const res = await api.get<HealthResponse>("/db-health");

    return toHealthStatus(res.data);
  } catch {
    const res = await api.get<HealthResponse>("/health/db");

    return toHealthStatus(res.data);
  }
}
