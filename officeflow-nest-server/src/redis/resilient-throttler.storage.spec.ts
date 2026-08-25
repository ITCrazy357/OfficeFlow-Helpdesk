import { RedisService } from './redis.service';
import { ResilientThrottlerStorage } from './resilient-throttler.storage';

describe('ResilientThrottlerStorage', () => {
  it('uses the atomic Redis storage while Redis is ready', async () => {
    const client = {
      scriptLoad: jest.fn().mockResolvedValue('a'.repeat(40)),
      evalSha: jest.fn().mockResolvedValue([1, 60_000, -1, 0]),
    };
    const redis = {
      isReady: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(client),
    };
    const storage = new ResilientThrottlerStorage(
      redis as unknown as RedisService,
    );

    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'login-pair'),
    ).resolves.toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: -1,
    });
    expect(client.scriptLoad).toHaveBeenCalledTimes(1);
    expect(client.evalSha).toHaveBeenCalledTimes(1);
  });

  it('keeps enforcing limits per instance when Redis is unavailable', async () => {
    const redis = {
      isReady: jest.fn().mockReturnValue(false),
      getClient: jest.fn().mockReturnValue({}),
    };
    const storage = new ResilientThrottlerStorage(
      redis as unknown as RedisService,
    );

    const first = await storage.increment(
      'fallback-key',
      60_000,
      1,
      60_000,
      'login-pair',
    );
    const second = await storage.increment(
      'fallback-key',
      60_000,
      1,
      60_000,
      'login-pair',
    );

    expect(first.isBlocked).toBe(false);
    expect(second.isBlocked).toBe(true);
    storage.onApplicationShutdown();
  });
});
