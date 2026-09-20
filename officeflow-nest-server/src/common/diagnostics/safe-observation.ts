import { Logger } from '@nestjs/common';
import { getCurrentRequestId } from './request-context';

const logger = new Logger('Observability');

// Instrumentation must not replace a business result or its original error.
export function observeSafely(record: () => void): void {
  try {
    record();
  } catch {
    logger.warn({
      event: 'metrics_record_failed',
      requestId: getCurrentRequestId(),
    });
  }
}
