import axios from "axios";
import { getAccessToken, removeAccessToken } from "./token";
import type { ApiErrorResponse } from "@/types/api";

const DEFAULT_API_TIMEOUT_MS = 70000;
const configuredApiTimeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS);
const apiTimeout =
  Number.isFinite(configuredApiTimeout) && configuredApiTimeout > 0
    ? configuredApiTimeout
    : DEFAULT_API_TIMEOUT_MS;

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api",
  timeout: apiTimeout,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = axios.isAxiosError<ApiErrorResponse>(error)
      ? error.response?.data?.message
      : undefined;

    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || message === "Invalid or expired token")
    ) {
      removeAccessToken();
    }

    return Promise.reject(error);
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
