import { getAllowedOrigins, isAllowedOrigin } from './allowed-origins';

describe('allowed origins', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('allows loopback origins on any port in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = '';

    expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
  });

  it('normalizes configured origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL =
      'https://helpdesk.example.com/path, https://admin.example.com/';

    expect(getAllowedOrigins()).toEqual([
      'https://helpdesk.example.com',
      'https://admin.example.com',
    ]);
    expect(isAllowedOrigin('https://helpdesk.example.com')).toBe(true);
  });

  it('rejects an origin outside the production allowlist', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://helpdesk.example.com';

    expect(isAllowedOrigin('https://unknown.example.com')).toBe(false);
    expect(isAllowedOrigin('not-an-origin')).toBe(false);
  });
});
