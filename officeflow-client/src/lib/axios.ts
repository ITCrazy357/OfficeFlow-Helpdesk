import axios from "axios";
import { getAccessToken, removeAccessToken } from "./token";
import { ApiErrorResponse } from "../types/api";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  timeout: 10000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
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
    return error.response?.data?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
