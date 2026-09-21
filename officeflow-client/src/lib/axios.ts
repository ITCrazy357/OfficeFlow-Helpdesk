import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { getAccessToken, removeAccessToken, setAccessToken } from "./token";
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

export function isUnauthorizedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function isRefreshExcludedEndpoint(url?: string) {
  const path = url?.split("?")[0];

  return ["/auth/login", "/auth/refresh", "/auth/logout"].includes(path ?? "");
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
        if (isUnauthorizedError(error)) {
          removeAccessToken();
        }
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
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

// Use the backend's identifier, never an outgoing/client-generated value.
export function getApiRequestId(error: unknown): string | undefined {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return undefined;

  const headers = error.response?.headers;
  const candidates: unknown[] = [
    headers instanceof axios.AxiosHeaders
      ? headers.get("x-request-id")
      : headers?.["x-request-id"],
    error.response?.data?.requestId,
  ];
  return candidates.find(
    (value): value is string =>
      typeof value === "string" &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        value,
      ),
  );
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Đã xảy ra lỗi. Vui lòng thử lại.",
) {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    // Keep 4xx messages unchanged: feature-level translators match those strings.
    const requestId =
      error.response &&
      error.response.status >= 500 &&
      error.response.status < 600
        ? getApiRequestId(error)
        : undefined;
    const withRequestId = (message: string) =>
      requestId ? `${message} (Mã yêu cầu: ${requestId})` : message;

    if (
      error.code === "ECONNABORTED" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return withRequestId(
        "Máy chủ đang khởi động, vui lòng thử lại sau ít giây.",
      );
    }

    return withRequestId(
      error.response?.data?.message || error.message || fallback,
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
