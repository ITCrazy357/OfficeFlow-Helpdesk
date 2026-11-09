import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsTokenGuard } from './metrics-token.guard';

@Module({
  imports: [ConfigModule],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsTokenGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
