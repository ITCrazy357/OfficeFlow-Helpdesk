import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';

import { getRequestDiagnostics } from '../diagnostics/request-diagnostics';
import { runWithRequestContext } from '../diagnostics/request-context';

import { MetricsService } from 'src/metrics/metrics.service';

const logger = new Logger('RequestObservability');

export function requestObservabilityMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
  metrics: Pick<MetricsService, 'recordHttp'>,
): void {
  const startedAt = performance.now();
  const { requestId } = getRequestDiagnostics(request);

  // Chụp path sớm; không ghi query string vào log.
  const path = request.path || request.originalUrl.split('?', 1)[0];

  response.setHeader('X-Request-Id', requestId);

  let logged = false;

  function recordOutcome(completed: boolean): void {
    if (logged) return;
    logged = true;

    //Sau khi đã xác định outcome thì gỡ listener
    response.off('finish', onFinish);
    response.off('close', onClose);

    const entry = {
      event: completed ? 'http_request_completed' : 'http_request_aborted',
      requestId,
      method: request.method,
      path,
      // Không ghi status mặc định 200 nếu response bị ngắt sớm.
      statusCode: completed ? response.statusCode : null,
      durationMs: Math.round(performance.now() - startedAt),
    };

    const isMetricsRequest = /^\/api\/metrics\/?$/i.test(path);

    if (!isMetricsRequest) {
      try {
        metrics.recordHttp(
          completed ? 'completed' : 'aborted',
          entry.durationMs,
          entry.statusCode,
        );
      } catch {
        logger.warn({
          event: 'http_metrics_record_failed',
          requestId,
        });
      }
    }

    if (completed) {
      logger.log(entry);
    } else {
      logger.warn(entry);
    }
  }

  function onFinish(): void {
    recordOutcome(true);
  }

  //Khi close xảy ra, kiểm tra xem response đã thực sự ghi xong chưa.
  function onClose(): void {
    recordOutcome(response.writableFinished);
  }

  //listener chỉ chạy một lần.
  response.once('finish', onFinish);
  response.once('close', onClose);

  runWithRequestContext({ requestId }, () => next());
}
