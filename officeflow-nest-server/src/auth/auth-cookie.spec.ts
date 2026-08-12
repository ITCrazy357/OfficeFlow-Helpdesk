import type { Response } from 'express';

import {
  clearRefreshCookie,
  getRefreshCookieName,
  setRefreshCookie,
} from './auth-cookie';

describe('auth cookie', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function createResponse() {
    const clearCookie = jest.fn();
    const cookie = jest.fn();
    const setHeader = jest.fn();

    return {
      clearCookie,
      cookie,
      response: { clearCookie, cookie, setHeader } as unknown as Response,
      setHeader,
    };
  }

  it('sets a production __Host cookie and prevents token response caching', () => {
    process.env.NODE_ENV = 'production';
    const { cookie, response, setHeader } = createResponse();
    const expiresAt = new Date(Date.now() + 60_000);

    setRefreshCookie(response, 'refresh-token', expiresAt);

    expect(getRefreshCookieName()).toBe('__Host-officeflow_refresh');
    expect(cookie).toHaveBeenCalledWith(
      '__Host-officeflow_refresh',
      'refresh-token',
      expect.objectContaining({
        expires: expiresAt,
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: true,
      }),
    );
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('clears the development cookie with matching options and no-store headers', () => {
    process.env.NODE_ENV = 'development';
    const { clearCookie, response, setHeader } = createResponse();

    clearRefreshCookie(response);

    expect(clearCookie).toHaveBeenCalledWith('officeflow_refresh', {
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: false,
    });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });
});
