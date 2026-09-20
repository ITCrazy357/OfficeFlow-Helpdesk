import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

type HttpOutcome = 'completed' | 'aborted';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry(); //Một nơi chứa các metrics của Prometheus.

  private readonly requests = new Counter({
    name: 'officeflow_http_requests_total',
    help: 'Number of HTTP requests that completed or aborted',
    labelNames: ['outcome', 'status_class'] as const, //phân loại theo 'completed' và 'aborted'
    registers: [this.registry],
  });

  private readonly duration = new Histogram({
    name: 'officeflow_http_request_duration_seconds',
    help: 'HTTP duration until completion or abort',
    labelNames: ['outcome'] as const, //phân loại theo 'completed' và 'aborted'
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [this.registry],
  });

  private readonly redisFallbacks = new Counter({
    name: 'officeflow_redis_fallback_total',
    help: 'Number of operations using fallback because Redis is unavailable',
    labelNames: ['component'] as const,
    registers: [this.registry],
  });

  private readonly mailAttempts = new Counter({
    name: 'officeflow_mail_send_attempts_total',
    help: 'Mail send attempts grouped by result',
    labelNames: ['result'] as const, //phân loại theo 'success' và 'failure'
    registers: [this.registry],
  });

  recordHttp(
    outcome: HttpOutcome,
    durationMs: number,
    statusCode: number | null,
  ): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    const statusClass =
      outcome === 'aborted'
        ? 'none'
        : statusCode !== null &&
            Number.isInteger(statusCode) &&
            statusCode >= 100 &&
            statusCode <= 599
          ? `${Math.floor(statusCode / 100)}xx`
          : 'unknown';

    this.requests.inc({
      outcome,
      status_class: statusClass,
    });

    this.duration.observe({ outcome }, durationMs / 1000);
  }

  recordRedisFallback(component: 'rate_limit' | 'dashboard_cache'): void {
    this.redisFallbacks.inc({ component });
  }

  recordMailAttempt(
    result: 'accepted' | 'partial' | 'rejected' | 'error' | 'skipped',
  ): void {
    this.mailAttempts.inc({ result });
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
