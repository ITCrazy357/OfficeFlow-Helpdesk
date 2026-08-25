import { Global, Module } from '@nestjs/common';
import { ResilientThrottlerStorage } from './resilient-throttler.storage';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, ResilientThrottlerStorage],
  exports: [RedisService, ResilientThrottlerStorage],
})
export class RedisModule {}
