import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

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

  private readonly mailEnabled = new Gauge({
    name: 'officeflow_mail_enabled',
    help: 'Whether mail is configured and enabled',
    registers: [this.registry],
  });
  private readonly smtpVerify = new Counter({
    name: 'officeflow_smtp_verify_total',
    help: 'SMTP verification attempts, not mail sends',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });
  private readonly errors = new Counter({
    name: 'officeflow_errors_total',
    help: 'Observed failures by bounded source, not unique incidents',
    labelNames: ['source'] as const,
    registers: [this.registry],
  });
  private readonly readyJobs = new Gauge({
    name: 'officeflow_outbox_ready_jobs',
    help: 'Jobs eligible at the latest snapshot',
    registers: [this.registry],
  });
  private readonly exhaustedJobs = new Gauge({
    name: 'officeflow_outbox_exhausted_jobs',
    help: 'Failed jobs with no attempts remaining',
    registers: [this.registry],
  });
  private readonly oldestReadyAge = new Gauge({
    name: 'officeflow_outbox_oldest_ready_age_seconds',
    help: 'Age since availableAt at snapshot time',
    registers: [this.registry],
  });
  private readonly collectionSuccess = new Gauge({
    name: 'officeflow_outbox_collection_success',
    help: 'Latest collection succeeded, zero until first collection',
    registers: [this.registry],
  });
  private readonly lastCollection = new Gauge({
    name: 'officeflow_outbox_last_collection_timestamp_seconds',
    help: 'Time of last successful snapshot',
    registers: [this.registry],
  });
  private readonly lastPoll = new Gauge({
    name: 'officeflow_outbox_last_poll_success_timestamp_seconds',
    help: 'Time of last successful poll, not handler success',
    registers: [this.registry],
  });
  private readonly polls = new Counter({
    name: 'officeflow_outbox_polls_total',
    help: 'Completed worker polls',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  constructor() {
    for (const component of ['rate_limit', 'dashboard_cache'])
      this.redisFallbacks.inc({ component }, 0);
    for (const result of [
      'accepted',
      'partial',
      'rejected',
      'error',
      'skipped',
    ])
      this.mailAttempts.inc({ result }, 0);
    for (const result of ['success', 'error']) {
      this.smtpVerify.inc({ result }, 0);
      this.polls.inc({ result }, 0);
    }
    for (const source of ['http', 'outbox', 'outbox_collector', 'smtp'])
      this.errors.inc({ source }, 0);
  }

  recordError(source: 'http' | 'outbox' | 'outbox_collector' | 'smtp'): void {
    this.errors.inc({ source });
  }
  setMailEnabled(enabled: boolean): void {
    this.mailEnabled.set(enabled ? 1 : 0);
  }
  private readonly smtpVerifySuccess = new Gauge({
    name: 'officeflow_smtp_verify_success',
    help: 'Latest startup SMTP verification succeeded',
    registers: [this.registry],
  });

  recordSmtpVerify(result: 'success' | 'error'): void {
    this.smtpVerify.inc({ result });
    this.smtpVerifySuccess.set(result === 'success' ? 1 : 0);
  }

  recordOutboxSnapshot(snapshot: {
    ready: number;
    exhausted: number;
    oldestAgeSeconds: number;
    sampledAt: Date;
  }): void {
    this.readyJobs.set(snapshot.ready);
    this.exhaustedJobs.set(snapshot.exhausted);
    this.oldestReadyAge.set(snapshot.oldestAgeSeconds);
    this.lastCollection.set(snapshot.sampledAt.getTime() / 1000);
    this.collectionSuccess.set(1);
  }
  recordOutboxCollectionFailure(): void {
    this.collectionSuccess.set(0);
    this.recordError('outbox_collector');
  }
  recordOutboxPoll(result: 'success' | 'error'): void {
    this.polls.inc({ result });
    if (result === 'success') this.lastPoll.set(Date.now() / 1000);
  }

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
