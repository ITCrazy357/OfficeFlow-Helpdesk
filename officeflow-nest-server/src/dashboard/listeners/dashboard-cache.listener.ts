import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class DashboardCacheListener {
  constructor(private readonly redis: RedisService) {}

  @OnEvent('ticket.metrics_changed', {
    async: true,
    suppressErrors: true,
  })
  async handleTicketMetricsChanged() {
    await this.redis.incr('dashboard:version');
  }
}
