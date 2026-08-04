import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import {
  getAccessToken,
  removeAccessToken,
  setAccessToken,
} from "./token";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";

const DEFAULT_API_TIMEOUT_MS = 70000;
const configuredApiTimeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS);
const apiTimeout =
  Number.isFinite(configuredApiTimeout) && configuredApiTimeout > 0
    ? configuredApiTimeout
    : DEFAULT_API_TIMEOUT_MS;

const apiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api",
  timeout: apiTimeout,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
};

export const api = axios.create(apiConfig);
const authApi = axios.create(apiConfig);

type RefreshAccessTokenResponse = {
  accessToken: string;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshRequest: Promise<string> | null = null;

function isRefreshExcludedEndpoint(url?: string) {
  const path = url?.split("?")[0];

  return [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
  ].includes(path ?? "");
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshRequest) {
    refreshRequest = authApi
      .post<ApiResponse<RefreshAccessTokenResponse>>("/auth/refresh")
      .then((response) => {
        const token = response.data.data.accessToken;
        setAccessToken(token);
        return token;
      })
      .catch((error: unknown) => {
        removeAccessToken();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      !axios.isAxiosError<ApiErrorResponse>(error) ||
      error.response?.status !== 401
    ) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      !originalRequest ||
      originalRequest._retry ||
      isRefreshExcludedEndpoint(originalRequest.url)
    ) {
      removeAccessToken();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await refreshAccessToken();
      originalRequest.headers.set("Authorization", `Bearer ${token}`);
      return api.request(originalRequest);
    } catch {
      removeAccessToken();
      return Promise.reject(error);
    }
  },
);

export function getApiErrorMessage(
  error: unknown,
  fallback = "Đã xảy ra lỗi. Vui lòng thử lại.",
) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (
      error.code === "ECONNABORTED" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return "Máy chủ đang khởi động, vui lòng thử lại sau ít giây.";
    }

    return error.response?.data?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
