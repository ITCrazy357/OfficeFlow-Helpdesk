import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import {
  DASHBOARD_CACHE_INVALIDATE_EVENT,
  type DashboardCacheInvalidatedEvent,
} from '../events/dashboard-cache-invalidated.event';

@Injectable()
export class DashboardCacheListener {
  private readonly logger = new Logger(DashboardCacheListener.name);

  constructor(private readonly redis: RedisService) {}

  @OnEvent(DASHBOARD_CACHE_INVALIDATE_EVENT)
  async handleDashboardCacheInvalidation(
    event: DashboardCacheInvalidatedEvent,
  ) {
    try {
      await this.redis.incrementDashboardVersion();
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      this.logger.warn(
        `Dashboard cache invalidation skipped (${event.reason})${detail}`,
      );
    }
  }
}
