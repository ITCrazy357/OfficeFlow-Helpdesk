import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader, rejectStatus } from "./helpers/source-loader.mjs";

test("asset supplier fields trim, clear explicitly and obey API limits", () => {
  const { assetFormSchema, toAssetPayload, toAssetUpdatePayload } = createSourceLoader()("features/assets/schemas.ts");
  const base = { assetTag: "LAP-5", name: "Laptop", type: "LAPTOP", supplierName: "  Supplier  ", supplierContact: "  0123456789  " };
  assert.equal(toAssetPayload(assetFormSchema.parse(base)).supplierName, "Supplier");
  assert.equal(toAssetUpdatePayload({ ...base, supplierName: " ", supplierContact: "" }).supplierContact, null);
  assert.equal(toAssetUpdatePayload({ ...base, supplierName: " ", supplierContact: "" }).supplierName, null);
  assert.equal(assetFormSchema.safeParse({ ...base, supplierName: "x".repeat(151) }).success, false);
  assert.equal(assetFormSchema.safeParse({ ...base, supplierContact: "x".repeat(251) }).success, false);
  const utils = createSourceLoader()("features/assets/care-utils.ts");
  assert.equal(utils.careToday(new Date("2026-10-18T17:00:00Z")), "2026-10-19");
  assert.equal(utils.careWarrantyDate("2026-10-18T17:00:00Z"), "2026-10-19");
  assert.equal(utils.careWarrantyDate("2026-10-18T00:00:00Z"), "2026-10-18");
  assert.equal(utils.careWarrantyDate(null), "");
  assert.equal(utils.maintenanceCost(null), "Chưa ghi nhận");
  assert.match(utils.maintenanceCost("0"), /^0/);
  assert.match(utils.maintenanceCost("999999999999"), /999\.999\.999\.999/);
});

test("maintenance API preserves version, exact VND string, null cost, filters and cancellation", async () => {
  const calls = [];
  const record = { id: 8 };
  const load = createSourceLoader({ "@/lib/axios": { api: Object.fromEntries(["get", "post", "patch"].map((method) => [method, async (...args) => { calls.push([method, ...args]); return { data: { data: record } }; }])) } });
  const api = load("features/assets/care-api.ts");
  const signal = new AbortController().signal;
  await api.getAssetMaintenance(5, { page: 2, limit: 10, status: "COMPLETED" }, signal);
  assert.deepEqual(calls.at(-1), ["get", "/assets/5/maintenance", { params: { page: 2, limit: 10, status: "COMPLETED" }, signal }]);
  await api.saveAssetMaintenance(5, { action: "create", input: { title: "Repair", kind: "REPAIR", scheduledFor: "2026-10-19" } });
  assert.equal(calls.at(-1)[1], "/assets/5/maintenance");
  for (const action of ["update", "complete", "cancel"]) {
    const input = { version: 3, cost: action === "complete" ? "999999999999" : null };
    assert.deepEqual(await api.saveAssetMaintenance(5, { action, id: 8, input }), record);
    assert.deepEqual(calls.at(-1), ["patch", `/assets/5/maintenance/8${action === "update" ? "" : `/${action}`}`, input]);
  }
});

test("maintenance hooks clear sensitive caches on access loss and refresh care data after failed writes", async () => {
  const cleared = [], invalidated = [];
  const denied = rejectStatus({}, 403);
  const load = createSourceLoader({
    "@tanstack/react-query": { useQuery: (options) => options, useMutation: (options) => options, useQueryClient: () => ({ setQueriesData: (...args) => cleared.push(args), invalidateQueries: async (filter) => invalidated.push(filter) }) },
    "./care-api": { getAssetMaintenance: async () => { throw denied; } },
  });
  const hooks = load("features/assets/care-hooks.ts");
  const query = hooks.useAssetMaintenance(5, { page: 2 });
  await assert.rejects(query.queryFn({ signal: new AbortController().signal }), (error) => error === denied);
  assert.deepEqual(cleared, [[{ queryKey: ["assets", "care"] }, null]]);
  await hooks.useSaveAssetMaintenance(5).onSettled();
  assert.deepEqual(invalidated, [{ queryKey: ["assets"] }]);
});

test("asset edits explicitly clear optional text without sending an empty unique serial", () => {
  const { toAssetPayload, toAssetUpdatePayload } = createSourceLoader()(
    "features/assets/schemas.ts",
  );
  const values = {
    assetTag: "LAP-01",
    name: "Laptop",
    type: "LAPTOP",
    brand: "",
    model: "",
    serialNumber: "",
    notes: "",
  };
  const payload = JSON.parse(JSON.stringify(toAssetUpdatePayload(values)));
  for (const field of ["brand", "model", "serialNumber", "notes"])
    assert.equal(payload[field], null);
  assert.equal(toAssetPayload(values).serialNumber, undefined);
});
