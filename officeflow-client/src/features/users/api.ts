import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { UserListItem } from "./types";

export async function getUsersApi() {
  const res = await api.get<ApiResponse<UserListItem[]>>("/users");
  return res.data.data;
}
