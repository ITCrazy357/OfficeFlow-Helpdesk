import { Global, Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { OutboxMetricsCollector } from './outbox-metrics.collector';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CloudinaryCleanupListener } from './cloudinary-cleanup.listener';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [CloudinaryModule, MetricsModule],
  providers: [
    OutboxService,
    OutboxProcessor,
    CloudinaryCleanupListener,
    OutboxMetricsCollector,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
