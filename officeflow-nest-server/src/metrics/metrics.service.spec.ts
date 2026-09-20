import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('counts requests and converts milliseconds to seconds', async () => {
    const metrics = new MetricsService();

    metrics.recordHttp('completed', 250, 200);
    metrics.recordHttp('completed', 750, 200);
    metrics.recordHttp('aborted', 100, null);

    const output = await metrics.render();

    expect(output).toContain(
      'officeflow_http_requests_total{outcome="completed",status_class="2xx"} 2',
    );
    expect(output).toContain(
      'officeflow_http_requests_total{outcome="aborted",status_class="none"} 1',
    );
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_sum{outcome="completed"} 1',
    );
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_count{outcome="completed"} 2',
    );
  });

  it('keeps registries independent', async () => {
    const first = new MetricsService();
    const second = new MetricsService();

    first.recordHttp('completed', 100, 200);

    expect(await first.render()).toContain(
      'officeflow_http_requests_total{outcome="completed",status_class="2xx"} 1',
    );
    expect(await second.render()).not.toContain(
      'officeflow_http_requests_total{outcome="completed",status_class="2xx"} 1',
    );
  });

  it('ignores invalid durations without changing metrics', async () => {
    const metrics = new MetricsService();
    const before = await metrics.render();

    metrics.recordHttp('completed', -1, 200);
    metrics.recordHttp('completed', NaN, 200);
    metrics.recordHttp('completed', Infinity, 200);

    expect(await metrics.render()).toBe(before);
  });

  it.each([
    [100, '1xx'],
    [199, '1xx'],
    [200, '2xx'],
    [299, '2xx'],
    [300, '3xx'],
    [399, '3xx'],
    [400, '4xx'],
    [499, '4xx'],
    [500, '5xx'],
    [599, '5xx'],
    [null, 'unknown'],
    [99, 'unknown'],
    [600, 'unknown'],
    [200.5, 'unknown'],
    [NaN, 'unknown'],
    [Infinity, 'unknown'],
  ])('classifies completed status %s as %s', async (status, group) => {
    const metrics = new MetricsService();
    metrics.recordHttp('completed', 10, status);
    expect(await metrics.render()).toContain(
      `officeflow_http_requests_total{outcome="completed",status_class="${group}"} 1`,
    );
  });

  it('never presents an aborted response as completed even with a default 200', async () => {
    const metrics = new MetricsService();
    metrics.recordHttp('aborted', 0, 200);
    const output = await metrics.render();
    expect(output).toContain('outcome="aborted",status_class="none"} 1');
    expect(output).not.toContain('status_class="2xx"');
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_sum{outcome="aborted"} 0',
    );
  });

  it('exports cumulative histogram buckets in seconds and a Prometheus content type', async () => {
    const metrics = new MetricsService();
    metrics.recordHttp('completed', 250, 200);
    const output = await metrics.render();
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_bucket{le="0.1",outcome="completed"} 0',
    );
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_bucket{le="0.3",outcome="completed"} 1',
    );
    expect(output).toContain(
      'officeflow_http_request_duration_seconds_bucket{le="+Inf",outcome="completed"} 1',
    );
    expect(metrics.contentType).toContain('text/plain');
  });
});
