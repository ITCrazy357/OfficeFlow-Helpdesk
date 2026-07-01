import { apiRequest } from "@/shared/api/http-client";
import type { AuthUser, LoginResponse } from "@/features/auth/types";
import type {
  LoginFormValues,
  RegisterFormValues,
} from "@/features/auth/schemas/auth-schemas";

export const authService = {
  login(input: LoginFormValues) {
    return apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify(input),
    });
  },

  register(input: RegisterFormValues) {
    return apiRequest<AuthUser>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify(input),
    });
  },

  me() {
    return apiRequest<AuthUser>("/auth/me");
  },
};

