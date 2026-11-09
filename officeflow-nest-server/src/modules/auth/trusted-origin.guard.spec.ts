import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import { TrustedOriginGuard } from './trusted-origin.guard';

function createContext(headers: Request['headers']) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('TrustedOriginGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const guard = new TrustedOriginGuard();

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('allows an exact configured origin even when Fetch Metadata is cross-site', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://helpdesk.example.com';

    const context = createContext({
      origin: 'https://helpdesk.example.com',
      'sec-fetch-site': 'cross-site',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an origin outside the allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://helpdesk.example.com';

    const context = createContext({
      origin: 'https://unknown.example.com',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('requires an origin in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() => guard.canActivate(createContext({}))).toThrow(
      'Request origin is required',
    );
  });
});
