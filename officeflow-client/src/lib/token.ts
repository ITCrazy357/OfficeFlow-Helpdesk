const LEGACY_ACCESS_TOKEN_KEY = "officeflow_access_token";
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;

  if (typeof window !== "undefined") {
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  }
}

export function removeAccessToken(): void {
  setAccessToken(null);
}
