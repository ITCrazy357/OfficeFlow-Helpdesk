import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createSourceLoader } from "./helpers/source-loader.mjs";

test("ticket response APIs send the resolution cycle and validate a low rating before submission", async () => {
  const calls = [];
  const invalidated = [];
  const load = createSourceLoader({
    "@tanstack/react-query": { useMutation: options => options, useQueryClient: () => ({ invalidateQueries: async filter => invalidated.push(filter) }) },
    "@/lib/axios": { api: { post: async (...args) => { calls.push(args); } } },
  });
  const feedback = load("features/tickets/feedback.ts");
  assert.match(feedback.validateTicketRating(1, " "), /lý do/);
  assert.equal(feedback.validateTicketRating(2, "Chưa rõ hướng dẫn"), null);
  assert.equal(feedback.validateTicketRating(5, ""), null);
  assert.ok(feedback.validateTicketRating(0, ""));
  const mutation = feedback.useRespondToTicket(7);
  await mutation.mutationFn({ action: "reopen", resolutionVersion: 3, reason: "Vẫn lỗi VPN" });
  assert.deepEqual(calls, [["/tickets/7/reopen", { resolutionVersion: 3, reason: "Vẫn lỗi VPN" }]]);
  await mutation.onSettled();
  assert.deepEqual(invalidated, [{ queryKey: ["tickets"] }, { queryKey: ["dashboard"] }]);
});

test("all 25 ticket transitions match the backend contract", () => {
  const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
  const load = createSourceLoader({
    "@nestjs/common": { ConflictException: class extends Error {} },
    "@prisma/client": {
      TicketStatus: Object.fromEntries(
        statuses.map((status) => [status, status]),
      ),
    },
  });
  const { canTransitionTicket, isTerminalTicket } = load(
    "features/tickets/status-policy.ts",
  );
  const { assertTicketStatusTransition } = load(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../officeflow-nest-server/src/modules/tickets/ticket-status.policy.ts",
    ),
  );
  for (const from of statuses)
    for (const to of statuses) {
      let backendAllows = true;
      try {
        assertTicketStatusTransition(from, to);
      } catch {
        backendAllows = false;
      }
      assert.equal(
        canTransitionTicket(from, to),
        backendAllows,
        `${from} -> ${to}`,
      );
    }
  assert.equal(isTerminalTicket("CLOSED"), true);
  assert.equal(isTerminalTicket("CANCELLED"), true);
  assert.equal(isTerminalTicket("RESOLVED"), false);
});

test("ticket queue API preserves filters and sends one bulk assignment request", async () => {
  const calls = [];
  const workload = { items: [], unassignedTickets: 3 };
  const result = { assignedCount: 2, unchangedCount: 0 };
  const load = createSourceLoader({
    "@/lib/axios": {
      api: {
        get: async (url, options) => {
          calls.push(["get", url, options]);
          return { data: { data: url.endsWith("workload") ? workload : { items: [], pagination: {} } } };
        },
        patch: async (url, body) => {
          calls.push(["patch", url, body]);
          return { data: { data: result } };
        },
      },
    },
  });
  const api = load("features/tickets/api.ts");
  const params = { queue: "UNASSIGNED", activeOnly: true, slaState: "DUE_SOON", page: 2 };
  await api.getTicketsApi(params);
  assert.deepEqual(await api.getTicketWorkloadApi(), workload);
  const input = { ticketIds: [1, 2], assignedToId: 3 };
  assert.deepEqual(await api.bulkAssignTicketsApi(input), result);
  assert.deepEqual(calls, [
    ["get", "/tickets", { params }],
    ["get", "/tickets/workload", undefined],
    ["patch", "/tickets/bulk-assign", input],
  ]);
});

test("ticket mutations refresh workload and bulk assignment refreshes ticket data after failures too", async () => {
  const invalidated = [];
  const load = createSourceLoader({
    "@tanstack/react-query": {
      useMutation: (options) => options,
      useQueryClient: () => ({
        invalidateQueries: async ({ queryKey }) => invalidated.push(queryKey),
        setQueryData() {},
      }),
    },
    "@/features/assets/hooks": { assetsQueryKeys: { all: ["assets"] } },
    "./api": {},
  });
  const hooks = load("features/tickets/hooks.ts");
  for (const name of ["useCreateTicket", "useAssignTicket", "useUpdateTicketStatus", "useDeleteTicket"]) {
    invalidated.length = 0;
    hooks[name]().onSuccess({ id: 5 }, { id: 5 });
    assert(invalidated.some((key) => JSON.stringify(key) === '["tickets","workload"]'), name);
  }
  const mutation = hooks.useBulkAssignTickets();
  assert.equal(mutation.onMutate, undefined);
  for (const error of [null, new Error("Conflict")]) {
    invalidated.length = 0;
    await mutation.onSettled(undefined, error);
    assert.deepEqual(invalidated, [["tickets"]]);
  }
});
