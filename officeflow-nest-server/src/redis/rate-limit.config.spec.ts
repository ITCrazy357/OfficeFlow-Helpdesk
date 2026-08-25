import type { ExecutionContext } from '@nestjs/common';

import {
  createRateLimitKeyGenerator,
  getLoginAccountTracker,
  getLoginPairTracker,
  isLoginRequest,
} from './rate-limit.config';

function createContext(controller: string, handler: string) {
  return {
    getClass: () => ({ name: controller }),
    getHandler: () => ({ name: handler }),
  } as unknown as ExecutionContext;
}

describe('login rate-limit configuration', () => {
  it('identifies only the login handler', () => {
    expect(isLoginRequest(createContext('AuthController', 'login'))).toBe(true);
    expect(isLoginRequest(createContext('AuthController', 'refresh'))).toBe(
      false,
    );
  });

  it('normalizes and hashes email trackers without storing PII', () => {
    const first = getLoginAccountTracker({
      body: { email: ' User@Example.com ' },
    });
    const second = getLoginAccountTracker({
      body: { email: 'user@example.com' },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('user@example.com');
  });

  it('separates the same account by IP for the pair limiter', () => {
    const first = getLoginPairTracker({
      ip: '192.0.2.1',
      body: { email: 'user@example.com' },
    });
    const second = getLoginPairTracker({
      ip: '192.0.2.2',
      body: { email: 'user@example.com' },
    });

    expect(first).not.toBe(second);
  });

  it('generates namespaced opaque Redis keys', () => {
    const key = createRateLimitKeyGenerator('officeflow:test:rate-limit')(
      createContext('AuthController', 'login'),
      'tracker',
      'login-account',
    );

    expect(key).toMatch(/^officeflow:test:rate-limit:[a-f0-9]{64}$/);
    expect(key).not.toContain('tracker');
  });
});
