import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader, rejectStatus } from "./helpers/source-loader.mjs";

test("leave types and half-days validate without inferring a balance or counting calendar weekends", () => {
  const load = createSourceLoader();
  const { leaveRequestFormSchema, toLeaveRequestPayload } = load("features/leave-requests/schemas.ts");
  const utils = load("features/leave-requests/planning-utils.ts");
  const payload = { type: "ANNUAL", period: "MORNING", startDate: "2035-01-08", endDate: "2035-01-08", reason: " Nghỉ việc gia đình " };
  assert.equal(leaveRequestFormSchema.safeParse(payload).success, true);
  assert.deepEqual(toLeaveRequestPayload(payload), { ...payload, reason: "Nghỉ việc gia đình" });
  assert.equal(leaveRequestFormSchema.safeParse({ ...payload, endDate: "2035-01-09" }).success, false);
  assert.equal(leaveRequestFormSchema.safeParse({ ...payload, type: "LEGACY" }).success, false);
  assert.equal(utils.leaveDuration({ ...payload, days: [{ date: payload.startDate, halfDays: 1 }] }), "0.5 ngày công · Buổi sáng");
  assert.equal(utils.leaveDuration({ ...payload, days: [] }), "Đơn cũ: chưa xác định ngày công");
  assert.equal(utils.monthDays("2028-02").length, 29);
  assert.equal(utils.monthDays("2026-13").length, 0);
});

test("department calendar counts distinct people in the same session and uses saved working dates", () => {
  const utils = createSourceLoader()("features/leave-requests/planning-utils.ts");
  const morning = { id: 1, requester: { id: 1, name: "A" }, period: "MORNING", startDate: "2035-01-08", endDate: "2035-01-08", days: [{ date: "2035-01-08", halfDays: 1 }] };
  const afternoon = { ...morning, id: 2, requester: { id: 2, name: "B" }, period: "AFTERNOON" };
  assert.equal(utils.overlappingLeaveCount([morning, afternoon]), 1);
  assert.equal(utils.overlappingLeaveCount([morning, afternoon, { ...morning, id: 3, requester: { id: 3 } }]), 2);
  assert.equal(utils.overlappingLeaveCount([morning, { ...morning, id: 4, period: "AFTERNOON" }]), 1);
  assert.equal(utils.leavesOnDate([morning], "2035-01-09").length, 0);
  const spanning = { ...morning, startDate: "2035-01-05", days: [{ date: "2035-01-08", halfDays: 2 }] };
  assert.equal(utils.leavesOnDate([spanning], "2035-01-06").length, 0);
});

test("planning APIs retain year, scope and version; successful or conflicting writes refresh balances", async () => {
  const calls = [];
  const invalidated = [];
  const cleared = [];
  const data = { userId: 8, year: 2035, allowance: null, remaining: null, version: 0 };
  let failure;
  const transport = async (method, ...args) => { calls.push([method, ...args]); if (failure) throw failure; return { data: { data } }; };
  const load = createSourceLoader({
    "@tanstack/react-query": { useQuery: options => options, useMutation: options => options, useQueryClient: () => ({ invalidateQueries: async options => invalidated.push(options), setQueriesData: (...args) => cleared.push(args) }) },
    "@/lib/axios": { api: { get: (...args) => transport("GET", ...args), post: (...args) => transport("POST", ...args), put: (...args) => transport("PUT", ...args) } },
  });
  const hooks = load("features/leave-requests/planning.ts");
  const signal = new AbortController().signal;
  assert.deepEqual(await hooks.useLeaveBalance(2035, 8).queryFn({ signal }), data);
  assert.deepEqual(calls[0], ["GET", "/leave-request/balance", { params: { year: 2035, userId: 8 }, signal }]);
  const save = hooks.useSetLeaveEntitlement();
  await save.mutationFn({ userId: 8, year: 2035, days: 12.5, version: 2 });
  assert.deepEqual(calls[1], ["PUT", "/leave-request/entitlements/8", { days: 12.5, version: 2 }, { params: { year: 2035 } }]);
  await save.onSettled();
  assert.deepEqual(invalidated, [{ queryKey: ["leave-requests", "planning"] }]);
  failure = rejectStatus({}, 403);
  await assert.rejects(hooks.useLeaveCalendar("2035-01", 1).queryFn({ signal }));
  assert.deepEqual(cleared, [[{ queryKey: ["leave-requests", "planning"] }, null]]);
});

test("leave create, review and cancellation refresh balances and calendars even after conflicts", async () => {
  const refreshed = [];
  const load = createSourceLoader({
    "@tanstack/react-query": { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: async filter => refreshed.push(filter) }) },
    "./api": {},
  });
  const hooks = load("features/leave-requests/hooks.ts");
  for (const mutation of [hooks.useCreateLeaveRequest(), hooks.useApproveLeaveRequest(), hooks.useRejectLeaveRequest(), hooks.useCancelLeaveRequest()]) {
    await mutation.onSettled();
  }
  assert.deepEqual(refreshed, Array.from({ length: 4 }, () => ({ queryKey: ["leave-requests"] })));
});
