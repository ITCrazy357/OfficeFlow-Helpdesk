import type { CookieOptions, Request, Response } from 'express';

const DEVELOPMENT_REFRESH_COOKIE = 'officeflow_refresh';
const PRODUCTION_REFRESH_COOKIE = '__Host-officeflow_refresh';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function getRefreshCookieName() {
  return isProduction()
    ? PRODUCTION_REFRESH_COOKIE
    : DEVELOPMENT_REFRESH_COOKIE;
}

function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: '/',
  };
}

export function setRefreshCookie(
  response: Response,
  token: string,
  expiresAt: Date,
) {
  response.cookie(getRefreshCookieName(), token, {
    ...getRefreshCookieOptions(),
    expires: expiresAt,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearRefreshCookie(response: Response) {
  response.clearCookie(getRefreshCookieName(), getRefreshCookieOptions());
}

export function readRefreshCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[getRefreshCookieName()];

  return typeof value === 'string' && value.length > 0 ? value : null;
}
