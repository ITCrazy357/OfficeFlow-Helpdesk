import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import {
  RedisThrottlerStorage,
  ThrottlerAlgorithm,
} from '@nestjs-redis/throttler-storage';

import { RedisService } from './redis.service';

@Injectable()
export class ResilientThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(ResilientThrottlerStorage.name);
  private readonly redisStorage: RedisThrottlerStorage;
  private readonly memoryFallback = new ThrottlerStorageService();
  private degraded = false;

  constructor(private readonly redis: RedisService) {
    this.redisStorage = new RedisThrottlerStorage(
      redis.getClient(),
      ThrottlerAlgorithm.SlidingWindowCounter,
    );
  }

  private logDegraded(error?: unknown) {
    if (this.degraded) {
      return;
    }

    this.degraded = true;
    const detail = error instanceof Error ? `: ${error.message}` : '';
    this.logger.warn(
      `Redis rate-limit storage unavailable; using per-instance memory fallback${detail}`,
    );
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    if (this.redis.isReady()) {
      try {
        const result = await this.redisStorage.increment(
          key,
          ttl,
          limit,
          blockDuration, //Nếu vượt limit thì có thể block tracker trong một khoảng thời gian.
          throttlerName, //Tên policy/rate-limit configuration đang áp dụng.
        );

        if (this.degraded) {
          this.degraded = false;
          this.logger.log('Distributed rate limiting restored');
        }

        return result;
      } catch (error) {
        this.logDegraded(error);
      }
    } else {
      this.logDegraded();
    }

    // Ưu tiên API vẫn hoạt động hơn là đảm bảo distributed rate limit tuyệt đối.
    return this.memoryFallback.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName,
    );
  }

  onApplicationShutdown() {
    this.memoryFallback.onApplicationShutdown();
  }
}
