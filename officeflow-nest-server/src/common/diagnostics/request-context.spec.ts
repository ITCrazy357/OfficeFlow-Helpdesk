import { getCurrentRequestId, runWithRequestContext } from './request-context';

describe('Request context', () => {
  it('returns undefined outside a request context', () => {
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('exposes the ID and returns the callback result', () => {
    const result = runWithRequestContext({ requestId: 'request-a' }, () => {
      expect(getCurrentRequestId()).toBe('request-a');
      return 42;
    });
    expect(result).toBe(42);
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('preserves context across promises and timer callbacks', async () => {
    await runWithRequestContext({ requestId: 'request-a' }, async () => {
      await Promise.resolve();
      expect(getCurrentRequestId()).toBe('request-a');
      const timerId = await new Promise<string | undefined>((resolve) => {
        setImmediate(() => resolve(getCurrentRequestId()));
      });
      expect(timerId).toBe('request-a');
    });
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('isolates overlapping requests across an async boundary', async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = runWithRequestContext(
      { requestId: 'request-a' },
      async () => {
        await barrier;
        return getCurrentRequestId();
      },
    );
    const second = runWithRequestContext(
      { requestId: 'request-b' },
      async () => {
        release();
        await Promise.resolve();
        return getCurrentRequestId();
      },
    );
    expect(await Promise.all([first, second])).toEqual([
      'request-a',
      'request-b',
    ]);
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('restores the parent context after a nested context', () => {
    runWithRequestContext({ requestId: 'outer' }, () => {
      runWithRequestContext({ requestId: 'inner' }, () => {
        expect(getCurrentRequestId()).toBe('inner');
      });
      expect(getCurrentRequestId()).toBe('outer');
    });
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('propagates synchronous errors without leaking context', () => {
    const error = new Error('test failure');
    expect(() =>
      runWithRequestContext({ requestId: 'failed' }, () => {
        throw error;
      }),
    ).toThrow(error);
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('propagates async rejection without leaking context', async () => {
    const error = new Error('test failure');
    await expect(
      runWithRequestContext({ requestId: 'failed' }, async () => {
        await Promise.resolve();
        throw error;
      }),
    ).rejects.toBe(error);
    expect(getCurrentRequestId()).toBeUndefined();
  });
});
