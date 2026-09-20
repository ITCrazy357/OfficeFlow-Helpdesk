import { Global, Module } from '@nestjs/common';
import { ResilientThrottlerStorage } from './resilient-throttler.storage';
import { RedisService } from './redis.service';
import { MetricsModule } from '../metrics/metrics.module';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [RedisService, ResilientThrottlerStorage],
  exports: [RedisService, ResilientThrottlerStorage],
})
export class RedisModule {}
