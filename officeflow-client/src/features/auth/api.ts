import { api, requestSession } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  AuthUser,
  ChangePasswordInput,
  ChangePasswordResponse,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  LoginInput,
  LoginResponse,
  ResetForgottenPasswordInput,
  ResetForgottenPasswordResponse,
} from "./types";

export async function loginApi(input: LoginInput) {
  const res = await requestSession<ApiResponse<LoginResponse>>({
    method: "post",
    url: "/auth/login",
    data: input,
  });
  return res.data.data;
}

export async function getMeApi() {
  const res = await api.get<ApiResponse<AuthUser>>("/auth/me");
  return res.data.data;
}

export async function restoreSessionApi() {
  const res = await requestSession<ApiResponse<AuthUser>>({
    method: "get",
    url: "/auth/me",
  });
  return res.data.data;
}

export async function changePasswordApi(input: ChangePasswordInput) {
  const res = await requestSession<ApiResponse<ChangePasswordResponse>>({
    method: "patch",
    url: "/users/me/password",
    data: input,
  });
  return res.data.data;
}

export async function forgotPasswordApi(input: ForgotPasswordInput) {
  const res = await api.post<ApiResponse<ForgotPasswordResponse>>(
    "/auth/forgot-password",
    input,
  );
  return res.data.data;
}

export async function resetForgottenPasswordApi(
  input: ResetForgottenPasswordInput,
) {
  const res = await requestSession<ApiResponse<ResetForgottenPasswordResponse>>(
    { method: "post", url: "/auth/reset-password", data: input },
  );
  return res.data.data;
}

export async function logoutApi() {
  await requestSession({ method: "post", url: "/auth/logout" });
}

export async function logoutAllApi() {
  await requestSession({ method: "post", url: "/auth/logout-all" });
}
