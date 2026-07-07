import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { Department } from "./types";

export async function getDepartmentsApi() {
  const res = await api.get<ApiResponse<Department[]>>("/departments");
  return res.data.data;
}
