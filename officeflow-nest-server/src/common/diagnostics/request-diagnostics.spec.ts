import type { Request } from 'express';
import {
  getRequestDiagnostics,
  getSafeErrorDetails,
} from './request-diagnostics';

describe('Request diagnostics', () => {
  it('creates an internal ID and reuses it across interceptor/filter', () => {
    const request = {
      headers: { 'x-request-id': 'untrusted-client-value' },
    } as unknown as Request;
    const first = getRequestDiagnostics(request);
    expect(first.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(getRequestDiagnostics(request).requestId).toBe(first.requestId);
  });
  it('does not include the raw error message', () => {
    const details = getSafeErrorDetails(
      new Error('password=secret; token=secret'),
    );
    expect(JSON.stringify(details)).not.toContain('password=');
    expect(JSON.stringify(details)).not.toContain('token=');
    expect(details.errorName).toBe('Error');
  });
});
