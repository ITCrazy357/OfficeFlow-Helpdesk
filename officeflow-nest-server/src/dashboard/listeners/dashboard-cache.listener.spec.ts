import { DashboardCacheInvalidatedEvent } from '../events/dashboard-cache-invalidated.event';
import { RedisService } from '../../redis/redis.service';
import { DashboardCacheListener } from './dashboard-cache.listener';

describe('DashboardCacheListener', () => {
  it('increments the shared version and tolerates Redis failures', async () => {
    const redis = {
      incrementDashboardVersion: jest
        .fn()
        .mockResolvedValueOnce(2)
        .mockRejectedValueOnce(new Error('Redis unavailable')),
    };
    const listener = new DashboardCacheListener(
      redis as unknown as RedisService,
    );
    const event = new DashboardCacheInvalidatedEvent('TICKET_CREATED', 1);

    await expect(
      listener.handleDashboardCacheInvalidation(event),
    ).resolves.toBeUndefined();
    await expect(
      listener.handleDashboardCacheInvalidation(event),
    ).resolves.toBeUndefined();
    expect(redis.incrementDashboardVersion).toHaveBeenCalledTimes(2);
  });
});
