import { validateEnvironment } from './environment.validation';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'mysql://test:test@localhost:3306/test',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('METRICS_TOKEN validation', () => {
  it('allows metrics to be disabled without a token', () => {
    expect(validateEnvironment(base).METRICS_TOKEN).toBeUndefined();
  });

  it('preserves a valid lowercase 64-character hexadecimal token', () => {
    const token = '0123456789abcdef'.repeat(4);
    expect(
      validateEnvironment({ ...base, METRICS_TOKEN: token }).METRICS_TOKEN,
    ).toBe(token);
  });

  it.each([
    '',
    null,
    123,
    false,
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'g'.repeat(64),
    ` ${'a'.repeat(64)}`,
    `${'a'.repeat(64)}\n`,
  ])('rejects malformed token %# without echoing its value', (token) => {
    expect(() =>
      validateEnvironment({ ...base, METRICS_TOKEN: token }),
    ).toThrow(
      'METRICS_TOKEN must contain exactly 64 lowercase hexadecimal characters',
    );
  });

  it('does not disclose the configured value in a validation error', () => {
    const token = 'private-invalid-metrics-token';
    try {
      validateEnvironment({ ...base, METRICS_TOKEN: token });
      throw new Error('Expected validation to reject invalid token');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(token);
      expect((error as Error).message).toContain('METRICS_TOKEN must');
    }
  });
});
