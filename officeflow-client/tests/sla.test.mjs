import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader } from "./helpers/source-loader.mjs";

test("SLA badges use the ticket warning time, support disabled warnings, and retain historical breaches", () => {
  const { getTicketSlaState } = createSourceLoader()("features/tickets/constants.ts");
  const now = new Date('2026-10-19T08:00:00Z');
  const ticket = { status: 'OPEN', dueAt: '2026-10-19T10:00:00Z', isOverdue: false };
  assert.equal(getTicketSlaState({ ...ticket, resolutionWarningAt: null }, now), 'ON_TRACK');
  assert.equal(getTicketSlaState({ ...ticket, resolutionWarningAt: '2026-10-19T07:30:00Z' }, now), 'DUE_SOON');
  assert.equal(getTicketSlaState({ ...ticket, resolutionWarningAt: '2026-10-19T09:00:00Z' }, now), 'ON_TRACK');
  assert.equal(getTicketSlaState({ ...ticket, status: 'RESOLVED', isOverdue: true }, now), 'OVERDUE');
});

test("SLA policy API preserves the editor version and explicit disabled first-response targets", async () => {
  const calls = [];
  const policy = { version: 3, config: { targets: { URGENT: { responseMinutes: null, resolutionMinutes: 240 } } } };
  const load = createSourceLoader({ '@/lib/axios': { api: {
    get: async (url) => { calls.push(['get', url]); return { data: { data: policy } }; },
    put: async (url, body) => { calls.push(['put', url, body]); return { data: { data: { ...body, version: 4 } } }; },
  } } });
  const api = load('features/sla/api.ts');
  assert.deepEqual(await api.getSlaPolicyApi(), policy);
  assert.equal((await api.updateSlaPolicyApi(policy)).version, 4);
  assert.deepEqual(calls, [['get', '/sla/policy'], ['put', '/sla/policy', policy]]);
});

test("cancelled tickets do not acquire a new response breach as wall-clock time passes", () => {
  const Component = () => null;
  const load = createSourceLoader({
    react: { useState: (initial) => [initial(), () => {}], useEffect() {} },
    '@/components/ui/card': { Card: Component, CardContent: Component, CardDescription: Component, CardHeader: Component, CardTitle: Component },
  });
  const { TicketResponseSla } = load('features/sla/components/ticket-response-sla.tsx');
  const collect = (node) => !node || typeof node !== 'object' ? String(node ?? '') : [node.props?.children].flat(Infinity).map(collect).join(' ');
  const ticket = { status: 'CANCELLED', firstResponseDueAt: '2000-01-01T00:00:00Z', firstRespondedAt: null, firstResponseOverdue: false };
  assert(!collect(TicketResponseSla({ ticket })).includes('Đã quá hạn phản hồi'));
  assert(collect(TicketResponseSla({ ticket: { ...ticket, firstResponseOverdue: true } })).includes('Đã quá hạn phản hồi'));
});
