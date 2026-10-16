import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { SlaPolicy } from "./types";

export async function getSlaPolicyApi() {
  const res = await api.get<ApiResponse<SlaPolicy>>("/sla/policy");
  return res.data.data;
}

export async function updateSlaPolicyApi(
  input: Pick<SlaPolicy, "version" | "config">,
) {
  const res = await api.put<ApiResponse<SlaPolicy>>("/sla/policy", input);
  return res.data.data;
}
