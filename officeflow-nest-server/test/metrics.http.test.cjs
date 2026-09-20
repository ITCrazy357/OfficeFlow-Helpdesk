// Run after npm run build:ci:
// node --test test/metrics.http.test.cjs
// Native Node loads the real ESM @nestjs/config on Node 22, unlike Jest's VM.
// Never bootstrap AppModule: only inspect its metadata for the wiring test.
require('./setup-env.cjs');
require('reflect-metadata');

const assert = require('node:assert/strict');
const { before, after, beforeEach, describe, it } = require('node:test');
const {
  Controller,
  Get,
  Logger,
  UnauthorizedException,
} = require('@nestjs/common');
const { MODULE_METADATA } = require('@nestjs/common/constants');
const { ConfigService } = require('@nestjs/config');
const { Reflector } = require('@nestjs/core');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { MetricsModule } = require('../dist/metrics/metrics.module');
const { MetricsService } = require('../dist/metrics/metrics.service');
const {
  HttpExceptionFilter,
} = require('../dist/common/filters/http-exception.filter');
const {
  ResponseInterceptor,
} = require('../dist/common/interceptors/response.interceptor');
const {
  requestObservabilityMiddleware,
} = require('../dist/common/middleware/request-observability.middleware');

class ProbeController {
  ok() {
    return { ok: true };
  }
  denied() {
    throw new UnauthorizedException();
  }
  fail() {
    throw new Error('private-test-error');
  }
}
Controller('probe')(ProbeController);
for (const name of ['ok', 'denied', 'fail']) {
  Get(name)(
    ProbeController.prototype,
    name,
    Object.getOwnPropertyDescriptor(ProbeController.prototype, name),
  );
}

const token = 'ab'.repeat(32);
let configuredToken = token;
let app;
let metrics;
let server;

describe(
  'Metrics HTTP using real Nest module and Node runtime',
  { concurrency: false },
  () => {
    before(async () => {
      const module = await Test.createTestingModule({
        imports: [MetricsModule],
        controllers: [ProbeController],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: (key) => (key === 'METRICS_TOKEN' ? configuredToken : undefined),
        })
        .compile();
      app = module.createNestApplication({ logger: false });
      metrics = app.get(MetricsService);
      app.use((req, res, next) =>
        requestObservabilityMiddleware(req, res, next, metrics),
      );
      app.setGlobalPrefix('api');
      app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
      app.useGlobalFilters(new HttpExceptionFilter());
    // One stable ephemeral loopback server for the whole suite; Supertest must
    // not auto-close a port still referenced by another pending test request.
    await app.listen(0, '127.0.0.1');
      server = app.getHttpServer();
    });

    beforeEach(() => {
      configuredToken = token;
    });
    after(async () => {
      if (app) await app.close();
    });

    function scrape(path = '/api/metrics') {
      return request(server).get(path).set('Authorization', `Bearer ${token}`);
    }

    function counter(output, group) {
      const line = output
        .split('\n')
        .find((value) =>
          value.startsWith(
            `officeflow_http_requests_total{outcome="completed",status_class="${group}"} `,
          ),
        );
      return line ? Number(line.slice(line.lastIndexOf(' ') + 1)) : 0;
    }

    it('returns 404, never metrics, when token is not configured', async () => {
      configuredToken = undefined;
      const res = await scrape().expect(404);
      assert.equal(res.body.success, false);
      assert.equal(res.text.includes('officeflow_http_requests_total'), false);
    });

    it('rejects missing, wrong, malformed and query-string tokens', async () => {
      const before = await metrics.render();
      const attempts = [
        request(server).get('/api/metrics'),
        request(server)
          .get('/api/metrics')
          .set('Authorization', `Bearer ${'c'.repeat(64)}`),
        request(server)
          .get('/api/metrics')
          .set('Authorization', 'Bearer short'),
        request(server)
          .get('/api/metrics')
          .set('Authorization', `Bearer ${token.toUpperCase()}`),
        request(server).get(`/api/metrics?token=${token}`),
      ];
      for (const attempt of attempts) {
        const res = await attempt.expect(401);
        assert.equal(res.body.requestId, res.headers['x-request-id']);
        assert.equal(
          res.text.includes('officeflow_http_requests_total'),
          false,
        );
      }
      assert.equal(await metrics.render(), before);
    });

    it('exports raw text and no-store headers through the global response interceptor', async () => {
      const res = await scrape().expect(200);
      assert.match(res.headers['content-type'], /^text\/plain/);
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.match(res.headers['x-request-id'], /^[a-f0-9-]{36}$/);
      assert.match(res.text, /# HELP officeflow_http_requests_total/);
      assert.equal(res.text.includes('"success":'), false);
      assert.equal(res.text.includes(token), false);
    });

    it('uses one shared registry for middleware and controller', async () => {
      const before = counter((await scrape().expect(200)).text, '2xx');
      await request(server).get('/api/probe/ok').expect(200);
      await request(server).get('/api/probe/ok').expect(200);
      const output = (await scrape().expect(200)).text;
      assert.equal(counter(output, '2xx'), before + 2);
      assert.equal(output, await metrics.render());
    });

    it('classifies real 401 and 500 responses once each', async () => {
      const before = await metrics.render();
      await request(server).get('/api/probe/denied').expect(401);
      await request(server).get('/api/probe/fail').expect(500);
      const after = (await scrape().expect(200)).text;
      assert.equal(counter(after, '4xx'), counter(before, '4xx') + 1);
      assert.equal(counter(after, '5xx'), counter(before, '5xx') + 1);
    });

    it('does not count repeated scrapes including case, trailing slash and query variants', async () => {
      const before = await metrics.render();
      for (const path of [
        '/api/metrics',
        '/api/metrics/',
        '/API/METRICS',
        '/api/metrics?format=text',
      ]) {
        await scrape(path).expect(200);
      }
      assert.equal(await metrics.render(), before);
    });

    it('keeps ordinary APIs working when metrics recording throws', async (t) => {
      t.mock.method(metrics, 'recordHttp', () => {
        throw new Error('recorder-secret');
      });
      const warnings = t.mock.method(Logger.prototype, 'warn', () => {});
      const res = await request(server).get('/api/probe/ok').expect(200);
      assert.equal(res.body.data.ok, true);
      assert.equal(warnings.mock.calls.length, 1);
      assert.equal(
        warnings.mock.calls[0].arguments[0].event,
        'http_metrics_record_failed',
      );
      assert.equal(
        JSON.stringify(warnings.mock.calls[0].arguments).includes(
          'recorder-secret',
        ),
        false,
      );
    });

    it('keeps the metrics bearer token out of access logs and diagnostics', async (t) => {
      const logs = t.mock.method(Logger.prototype, 'log', () => {});
      const warnings = t.mock.method(Logger.prototype, 'warn', () => {});
      await scrape().expect(200);
      await request(server)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${'c'.repeat(64)}`)
        .expect(401);
      const entries = [...logs.mock.calls, ...warnings.mock.calls].map(
        (call) => call.arguments,
      );
      assert.ok(entries.length > 0);
      assert.equal(JSON.stringify(entries).includes(token), false);
      assert.equal(JSON.stringify(entries).includes('c'.repeat(64)), false);
    });
  },
);

it('AppModule must register MetricsModule in Nest imports, not merely a TypeScript import', () => {
  const { AppModule } = require('../dist/app.module');
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
  assert.ok(
    imports.includes(MetricsModule),
    'Missing MetricsModule in @Module({ imports: [...] })',
  );
});
