import {
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MetricsTokenGuard } from './metrics-token.guard';

// Unit boundary only: exercise the real guard with controlled configuration.
// Do not load application .env or require the ESM config package through Jest.
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

const token = 'ab'.repeat(32);

function makeGuard(value: unknown = token) {
  const get = jest.fn().mockReturnValue(value);
  return new MetricsTokenGuard({ get } as unknown as ConfigService);
}

function context(authorization?: string, query: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization }, query }),
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsTokenGuard', () => {
  it('accepts only the configured token', () => {
    expect(makeGuard().canActivate(context(`Bearer ${token}`))).toBe(true);
  });

  it('accepts a case-insensitive Bearer scheme', () => {
    expect(makeGuard().canActivate(context(`bEaReR ${token}`))).toBe(true);
  });

  it.each([
    null,
    '',
    'a'.repeat(63),
    'a'.repeat(65),
    'g'.repeat(64),
    'A'.repeat(64),
  ])('fails closed for invalid configured token %#', (value) => {
    expect(() =>
      makeGuard(value).canActivate(context(`Bearer ${token}`)),
    ).toThrow(NotFoundException);
  });

  it('fails closed when the token is not configured', () => {
    const get = jest.fn().mockReturnValue(undefined);
    const guard = new MetricsTokenGuard({ get } as unknown as ConfigService);
    expect(() => guard.canActivate(context(`Bearer ${token}`))).toThrow(
      NotFoundException,
    );
  });

  it.each([
    undefined,
    '',
    'Bearer',
    `Basic ${token}`,
    `Bearer ${'c'.repeat(64)}`,
    `Bearer ${token.toUpperCase()}`,
    `Bearer ${'a'.repeat(63)}`,
    `Bearer ${'a'.repeat(65)}`,
    `Bearer ${'g'.repeat(64)}`,
    `Bearer  ${token}`,
    `Bearer ${token} `,
    `Bearer ${token}, Bearer ${token}`,
  ])('rejects missing, incorrect or malformed authorization %#', (header) => {
    expect(() => makeGuard().canActivate(context(header))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not accept credentials from the query string', () => {
    expect(() =>
      makeGuard().canActivate(context(undefined, { token })),
    ).toThrow(UnauthorizedException);
  });
});
