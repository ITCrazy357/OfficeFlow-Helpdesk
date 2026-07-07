import { api } from "@/lib/axios";
import { ApiResponse } from "@/types/api";
import { AuthUser, LoginInput, LoginResponse, RegisterInput } from "./types";

export async function loginApi(input: LoginInput) {
  const res = await api.post<ApiResponse<LoginResponse>>("/auth/login", input);
  return res.data.data;
}

export async function getMeApi() {
  const res = await api.get<ApiResponse<AuthUser>>("/auth/me");
  return res.data.data;
}

export async function registerApi(input: RegisterInput) {
  const res = await api.post<ApiResponse<AuthUser>>("/auth/register", input);
  return res.data.data;
}
