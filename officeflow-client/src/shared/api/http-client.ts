import type { ApiResponse } from "@/shared/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("officeflow_access_token");
}

export function setAccessToken(token: string) {
  localStorage.setItem("officeflow_access_token", token);
}

export function clearAccessToken() {
  localStorage.removeItem("officeflow_access_token");
}

function buildUrl(path: string, query?: Record<string, unknown>) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  query?: Record<string, unknown>,
) {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({
    success: false,
    message: "Invalid server response",
  }))) as ApiResponse<T>;

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.message || "Request failed",
      response.status,
      payload.errors,
    );
  }

  return payload.data as T;
}

