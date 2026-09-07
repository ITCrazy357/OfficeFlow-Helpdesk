import { Global, Module } from '@nestjs/common';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CloudinaryCleanupListener } from './cloudinary-cleanup.listener';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [CloudinaryModule],
  providers: [OutboxService, OutboxProcessor, CloudinaryCleanupListener],
  exports: [OutboxService],
})
export class OutboxModule {}
