import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  ChangeAccountLockInput,
  ChangeUserStatusInput,
  CreateUserInput,
  ResetUserPasswordInput,
  UpdateUserInput,
  UserListItem,
  HandoffUserInput,
  HandoffUserResult,
} from "./types";

export async function handoffUserApi(id: number, input: HandoffUserInput) {
  const res = await api.patch<ApiResponse<HandoffUserResult>>(
    `/users/${id}/handoff`,
    input,
  );
  return res.data.data;
}

export async function getUsersApi() {
  const res = await api.get<ApiResponse<UserListItem[]>>("/users");
  return res.data.data;
}

export async function createUserApi(input: CreateUserInput) {
  const res = await api.post<ApiResponse<UserListItem>>("/users", input);
  return res.data.data;
}

export async function updateUserApi(id: number, input: UpdateUserInput) {
  const res = await api.patch<ApiResponse<UserListItem>>(`/users/${id}`, input);
  return res.data.data;
}

export async function changeAccountLockApi(
  id: number,
  input: ChangeAccountLockInput,
) {
  const res = await api.patch<ApiResponse<UserListItem>>(
    `/users/${id}/lock-status`,
    input,
  );
  return res.data.data;
}

export async function changeUserStatusApi(
  id: number,
  input: ChangeUserStatusInput,
) {
  const res = await api.patch<ApiResponse<UserListItem>>(
    `/users/${id}/status`,
    input,
  );
  return res.data.data;
}

export async function resetUserPasswordApi(
  id: number,
  input: ResetUserPasswordInput,
) {
  const res = await api.patch<ApiResponse<UserListItem>>(
    `/users/${id}/reset-password`,
    input,
  );
  return res.data.data;
}
