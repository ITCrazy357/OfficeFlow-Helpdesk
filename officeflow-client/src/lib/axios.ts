import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, removeAccessToken, setAccessToken } from "./token";
import { assertRefreshCoordination, withSessionLock } from "./session-lock";
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

export function isUnauthorizedError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function isRefreshExcludedEndpoint(url?: string) {
  const path = url?.split("?")[0];

  return [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].includes(path ?? "");
}

// Called only while the shared session lock is held.
async function refreshAccessTokenUnlocked(): Promise<string> {
  assertRefreshCoordination();
  try {
    const response =
      await authApi.post<ApiResponse<RefreshAccessTokenResponse>>(
        "/auth/refresh",
      );
    const token = response.data.data.accessToken;
    setAccessToken(token);
    return token;
  } catch (error) {
    if (isUnauthorizedError(error)) removeAccessToken();
    throw error;
  }
}

async function recoverSession<T>(
  failedAuthorization: unknown,
  send: (token: string) => Promise<T>,
): Promise<T> {
  const current = getAccessToken();
  // A preceding request in this tab may already have refreshed the session.
  if (current && `Bearer ${current}` !== failedAuthorization) {
    try {
      return await send(current);
    } catch (error) {
      if (!isUnauthorizedError(error)) throw error;
    }
  }
  const token = await refreshAccessTokenUnlocked();
  try {
    return await send(token);
  } catch (error) {
    if (isUnauthorizedError(error)) removeAccessToken();
    throw error;
  }
}

type SessionRequest = {
  method: "get" | "post" | "patch";
  url: string;
  data?: unknown;
};

// Cookie-changing auth requests and restoration share the same cross-tab lock.
export function requestSession<T>(
  config: SessionRequest,
): Promise<AxiosResponse<T>> {
  return withSessionLock(async () => {
    const token = getAccessToken();
    const send = (accessToken: string | null) =>
      authApi.request<T>({
        ...config,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    try {
      return await send(token);
    } catch (error) {
      if (!isUnauthorizedError(error)) throw error;
      if (isRefreshExcludedEndpoint(config.url)) {
        removeAccessToken();
        throw error;
      }
      return recoverSession(token ? `Bearer ${token}` : undefined, send);
    }
  });
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

    const failedAuthorization = originalRequest.headers.get("Authorization");
    return withSessionLock(() =>
      recoverSession(failedAuthorization, (token) => {
        originalRequest.headers.set("Authorization", `Bearer ${token}`);
        // Keep the lock through the retry; another tab must not rotate this token
        // before the retried request reaches the backend session guard.
        return authApi.request(originalRequest);
      }),
    );
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
