import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const axios = nativeRequire("axios");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Compile the actual client modules in memory; no build artifacts or extra test dependencies.
function createSourceLoader(overrides = {}) {
  const cache = new Map();
  function load(relativePath) {
    const filename = path.resolve(testDirectory, "../src", relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const nativeRequire = createRequire(filename);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const requireSource = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.startsWith("@/")) return load(`${specifier.slice(2)}.ts`);
      if (specifier.startsWith("."))
        return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", source)(
      requireSource,
      loadedModule,
      loadedModule.exports,
    );
    return loadedModule.exports;
  }
  return load;
}

function setupApi(adapter) {
  const previousAdapter = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  const load = createSourceLoader();
  try {
    return { ...load("lib/axios.ts"), ...load("lib/token.ts") };
  } finally {
    axios.defaults.adapter = previousAdapter;
  }
}

test("performance dates use Vietnam midnight, validate real dates and allow 366 inclusive days", () => {
  const utils = createSourceLoader()("features/dashboard/performance-utils.ts");
  assert.deepEqual(
    utils.performanceDates(30, new Date("2026-10-18T17:00:00Z")),
    { from: "2026-09-20", to: "2026-10-19" },
  );
  assert.equal(
    utils.validatePerformanceDates(
      { from: "2025-10-20", to: "2026-10-20" },
      "2026-10-20",
    ),
    null,
  );
  for (const dates of [
    { from: "2025-10-19", to: "2026-10-20" },
    { from: "2026-02-30", to: "2026-10-20" },
    { from: "2026-10-21", to: "2026-10-20" },
    { from: "2026-10-20", to: "2026-10-21" },
    { from: "", to: "2026-10-20" },
  ])
    assert.equal(
      typeof utils.validatePerformanceDates(dates, "2026-10-20"),
      "string",
    );
});

test("performance CSV keeps missing values blank, real zeroes numeric, and escapes spreadsheet formulas", () => {
  const { performanceCsv, formatSlaDuration } = createSourceLoader()(
    "features/dashboard/performance-utils.ts",
  );
  const csv = performanceCsv({
    range: {
      from: "2026-10-01",
      to: "2026-10-18",
      timezone: "Asia/Ho_Chi_Minh",
    },
    generatedAt: "2026-10-18T00:00:00Z",
    cohort: {
      total: 1,
      completed: 1,
      everCompleted: 1,
      reopened: 0,
      reopenRate: 0,
      legacyCalendarTickets: 0,
      firstResponse: { minutes: null, samples: 0 },
      resolution: { minutes: 0, samples: 1 },
    },
    daily: [{ date: "2026-10-01", created: 1, completed: 1 }],
    backlog: [{ key: "test", label: '=SUM(1,2)"\r\n', total: 1 }],
  });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Phản hồi đầu tiên trung bình \(phút SLA\)",,,"0"/);
  assert.match(csv, /Giải quyết trung bình \(phút SLA, lần cuối\)",,"0","1"/);
  assert.ok(csv.includes('"\'=SUM(1,2)""\r\n"'));
  assert.equal(formatSlaDuration(null), "—");
  assert.equal(formatSlaDuration(0), "0 giờ");
  assert.equal(formatSlaDuration(120), "2 giờ");
});

test("performance queries cancel requests, preserve temporary failures and replace cached data after access loss", async () => {
  const dates = { from: "2026-01-01", to: "2026-01-31" };
  const signal = new AbortController().signal;
  let failure = null;
  const report = { cohort: { total: 3 } };
  const cleared = [];
  const load = createSourceLoader({
    "@tanstack/react-query": { useQuery: (options) => options, useQueryClient: () => ({ setQueriesData: (...args) => cleared.push(args) }) },
    "./api": { getDashboardPerformanceApi: async (actualDates, actualSignal) => {
      assert.deepEqual(actualDates, dates);
      assert.equal(actualSignal, signal);
      if (failure) throw failure;
      return report;
    } },
  });
  const options = load("features/dashboard/hooks.ts").useDashboardPerformance(dates);
  assert.deepEqual(options.queryKey, ["dashboard", "performance", dates]);
  assert.deepEqual(await options.queryFn({ signal }), { report, accessError: null });
  failure = rejectStatus({}, 503);
  await assert.rejects(options.queryFn({ signal }), (error) => error === failure);
  for (const status of [401, 403]) {
    failure = rejectStatus({}, status);
    assert.deepEqual(await options.queryFn({ signal }), { report: null, accessError: failure });
    assert.deepEqual(cleared.at(-1), [{ queryKey: ["dashboard", "performance"] }, { report: null, accessError: failure }]);
  }
});

test("PDF print snapshot preserves missing samples and escapes every report label", () => {
  const { performancePrintHtml } = createSourceLoader()("features/dashboard/performance-print.ts");
  const html = performancePrintHtml({
    range: { from: "2026-01-01", to: "2026-01-07", timezone: "Asia/Ho_Chi_Minh" },
    generatedAt: "2026-10-18T03:00:00Z",
    cohort: { total: 0, completed: 0, everCompleted: 0, reopened: 0, reopenRate: null, legacyCalendarTickets: 0, firstResponse: { minutes: null, samples: 0 }, resolution: { minutes: null, samples: 0 } },
    daily: [{ date: '<img src=x onerror="alert(1)">', created: 0, completed: 0 }],
    backlog: [{ key: "unsafe", label: '<script>alert("x")</script>&', total: 0 }],
  });
  assert.ok(html.includes('lang="vi"'));
  assert.ok(html.includes("size: A4"));
  assert.ok(html.includes("Nhóm ticket tạo từ 2026-01-01 đến 2026-01-07"));
  assert.ok(html.includes("10:00"));
  assert.ok(html.includes("Chưa có ticket trong khoảng đã chọn."));
  assert.equal((html.match(/class="value">—</g) ?? []).length, 3);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
});

function rejectStatus(config, status) {
  return new axios.AxiosError(
    `HTTP ${status}`,
    "ERR_BAD_RESPONSE",
    config,
    null,
    {
      status,
      data: {},
      headers: {},
      config,
      statusText: String(status),
    },
  );
}

test("API errors display the backend request ID, preferring the response header", () => {
  const client = setupApi(async () => {
    throw new Error("No network expected");
  });
  const error = rejectStatus({}, 500);
  const headerId = "12345678-1234-4234-8234-123456789abc";
  const bodyId = "abcdefab-1234-4234-8234-123456789abc";
  error.response.headers = axios.AxiosHeaders.from({
    "X-Request-Id": headerId,
  });
  error.response.data = { message: "Internal server error", requestId: bodyId };
  assert.equal(client.getApiRequestId(error), headerId);
  assert.equal(
    client.getApiErrorMessage(error),
    `Internal server error (Mã yêu cầu: ${headerId})`,
  );
  delete error.response.headers["X-Request-Id"];
  assert.equal(client.getApiRequestId(error), bodyId);
  assert.match(client.getApiErrorMessage(error), new RegExp(bodyId));
});

test("request ID extraction rejects arbitrary strings and does not invent IDs for network failures", () => {
  const client = setupApi(async () => {
    throw new Error("No network expected");
  });
  for (const value of [
    "Bearer secret",
    "<script>alert(1)</script>",
    "id\nforged",
    ["id"],
    123,
  ]) {
    const error = rejectStatus({}, 500);
    error.response.headers = { "x-request-id": value };
    error.response.data = {
      message: "Internal server error",
      requestId: value,
    };
    assert.equal(client.getApiRequestId(error), undefined);
    assert.equal(client.getApiErrorMessage(error), "Internal server error");
  }
  const offline = new axios.AxiosError("Network Error", "ERR_NETWORK");
  assert.equal(client.getApiRequestId(offline), undefined);
  assert.equal(client.getApiErrorMessage(offline), "Network Error");
  assert.equal(
    client.getApiErrorMessage(new Error("Local error")),
    "Local error",
  );
});

test("an invalid response header falls back to a valid body request ID", () => {
  const client = setupApi(async () => {
    throw new Error("No network expected");
  });
  const error = rejectStatus({}, 503);
  const id = "12345678-1234-4234-8234-123456789abc";
  error.response.headers = { "x-request-id": "invalid" };
  error.response.data = { message: "Service unavailable", requestId: id };
  assert.equal(client.getApiRequestId(error), id);
  assert.equal(
    client.getApiErrorMessage(error),
    `Service unavailable (Mã yêu cầu: ${id})`,
  );
});

test("business error translations remain intact when the response contains a request ID", () => {
  const client = setupApi(async () => {
    throw new Error("No network expected");
  });
  const { translateLifecycleMessage } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  const error = rejectStatus({}, 409);
  error.response.data = {
    message: "Handoff would create a reporting cycle",
    requestId: "12345678-1234-4234-8234-123456789abc",
  };
  assert.equal(client.getApiErrorMessage(error), error.response.data.message);
  assert.equal(
    translateLifecycleMessage(client.getApiErrorMessage(error)),
    "Không thể bàn giao cho người thuộc tuyến quản lý này vì sẽ tạo vòng lặp. Hãy chọn quản lý khác.",
  );
});

test("a temporary refresh failure preserves the session and surfaces the retryable error", async () => {
  for (const failure of ["offline", 429, 503]) {
    const client = setupApi(async (config) => {
      if (config.url !== "/auth/refresh") throw rejectStatus(config, 401);
      if (failure === "offline")
        throw new axios.AxiosError("Network Error", "ERR_NETWORK", config);
      throw rejectStatus(config, failure);
    });
    client.setAccessToken("existing-token");
    await assert.rejects(client.api.get("/auth/me"), (error) => {
      assert.equal(client.isUnauthorizedError(error), false);
      assert.equal(
        failure === "offline" ? error.code : error.response.status,
        failure === "offline" ? "ERR_NETWORK" : failure,
      );
      return true;
    });
    assert.equal(client.getAccessToken(), "existing-token");
  }
});

test("an expired refresh session clears the access token", async () => {
  const client = setupApi(async (config) => {
    throw rejectStatus(config, 401);
  });
  client.setAccessToken("expired-token");
  await assert.rejects(client.api.get("/auth/me"), client.isUnauthorizedError);
  assert.equal(client.getAccessToken(), null);
});

test("parallel unauthorized requests share one refresh and retry with the new token", async () => {
  let refreshes = 0;
  const client = setupApi(async (config) => {
    if (config.url === "/auth/refresh") {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        data: { data: { accessToken: "new-token" } },
        status: 200,
        headers: {},
        config,
      };
    }
    if (config.headers.get("Authorization") !== "Bearer new-token")
      throw rejectStatus(config, 401);
    return { data: { ok: true }, status: 200, headers: {}, config };
  });
  client.setAccessToken("old-token");
  const responses = await Promise.all([
    client.api.get("/auth/me"),
    client.api.get("/tickets"),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(
    responses.every((response) => response.data.ok),
    true,
  );
  assert.equal(client.getAccessToken(), "new-token");
});

test("login failures do not attempt a refresh", async () => {
  const requests = [];
  const client = setupApi(async (config) => {
    requests.push(config.url);
    throw rejectStatus(config, 401);
  });
  await assert.rejects(
    client.api.post("/auth/login", {}),
    client.isUnauthorizedError,
  );
  assert.deepEqual(requests, ["/auth/login"]);
});

test("ticket and knowledge forms reject content exceeding API limits", () => {
  const load = createSourceLoader();
  const { ticketFormSchema } = load("features/tickets/schemas.ts");
  const { knowledgeArticleFormSchema } = load("features/knowledge/schemas.ts");
  const ticket = {
    title: "VPN issue",
    description: "x".repeat(15_000),
    priority: "MEDIUM",
  };
  assert.equal(ticketFormSchema.safeParse(ticket).success, true);
  assert.equal(
    ticketFormSchema.safeParse({
      ...ticket,
      description: `${ticket.description}x`,
    }).success,
    false,
  );
  const article = {
    title: "VPN guide",
    content: ticket.description,
    tags: "x".repeat(1000),
    isPublished: false,
  };
  assert.equal(knowledgeArticleFormSchema.safeParse(article).success, true);
  assert.equal(
    knowledgeArticleFormSchema.safeParse({
      ...article,
      content: `${article.content}x`,
    }).success,
    false,
  );
  assert.equal(
    knowledgeArticleFormSchema.safeParse({
      ...article,
      tags: `${article.tags}x`,
    }).success,
    false,
  );
});

test("clearing knowledge summary and tags survives JSON serialization", () => {
  const { toKnowledgeArticlePayload } = createSourceLoader()(
    "features/knowledge/schemas.ts",
  );
  const payload = JSON.parse(
    JSON.stringify(
      toKnowledgeArticlePayload({
        title: "VPN guide",
        content: "A detailed VPN setup guide",
        summary: " ",
        tags: " , ",
        isPublished: false,
      }),
    ),
  );
  assert.equal(payload.summary, "");
  assert.equal(payload.tags, "");
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

test("leave and asset forms reject impossible calendar dates", () => {
  const load = createSourceLoader();
  const { leaveRequestFormSchema } = load("features/leave-requests/schemas.ts");
  const { assetFormSchema } = load("features/assets/schemas.ts");
  const year = new Date().getFullYear() + 4;
  assert.equal(
    leaveRequestFormSchema.safeParse({
      startDate: `${year}-02-30`,
      endDate: `${year}-03-01`,
      reason: "Annual leave",
    }).success,
    false,
  );
  const asset = { assetTag: "LAP-01", name: "Laptop", type: "LAPTOP" };
  assert.equal(
    assetFormSchema.safeParse({ ...asset, purchaseDate: "2028-02-29" }).success,
    true,
  );
  assert.equal(
    assetFormSchema.safeParse({ ...asset, purchaseDate: "2027-02-29" }).success,
    false,
  );
});

test("handoff candidates exclude the source, inactive/locked accounts and non-management roles", () => {
  const { getHandoffCandidates, isAvailableAccount } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  const user = { id: 1, role: "ADMIN", isActive: true, isLocked: false };
  const users = [
    user,
    { ...user, id: 2, role: "MANAGER" },
    { ...user, id: 3 },
    { ...user, id: 4, role: "IT_STAFF" },
    { ...user, id: 5, role: "EMPLOYEE" },
    { ...user, id: 6, isLocked: true },
    { ...user, id: 7, isActive: false },
  ];
  assert.deepEqual(
    getHandoffCandidates(users, 1).map((item) => item.id),
    [2, 3],
  );
  assert.equal(isAvailableAccount(users[5]), false);
  assert.equal(isAvailableAccount(users[6]), false);
});

test("the last usable ADMIN check ignores locked and inactive ADMINs", () => {
  const { isLastUsableAdmin } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  const admin = { id: 1, role: "ADMIN", isActive: true, isLocked: false };
  assert.equal(
    isLastUsableAdmin(admin, [admin, { ...admin, id: 2, isLocked: true }]),
    true,
  );
  assert.equal(
    isLastUsableAdmin(admin, [admin, { ...admin, id: 2, isActive: false }]),
    true,
  );
  assert.equal(isLastUsableAdmin(admin, [admin, { ...admin, id: 2 }]), false);
  assert.equal(
    isLastUsableAdmin({ ...admin, role: "EMPLOYEE" }, [admin]),
    false,
  );
});

test("handoff errors retain blocker counts and preserve unknown server errors", () => {
  const { translateLifecycleMessage } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  assert.match(
    translateLifecycleMessage(
      "Cannot deactivate user: 2 active tickets, 3 assigned assets, 4 pending approvals, 5 active subordinates require handoff.",
    ),
    /2 ticket.*3 tài sản.*4 đơn nghỉ.*5 nhân viên/,
  );
  assert.match(
    translateLifecycleMessage(
      "Replacement cannot approve their own leave request",
    ),
    /không được tự duyệt/,
  );
  assert.match(
    translateLifecycleMessage("Handoff would create a reporting cycle"),
    /vòng lặp/,
  );
  assert.equal(
    translateLifecycleMessage("Unexpected server message"),
    "Unexpected server message",
  );
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
      testDirectory,
      "../../officeflow-nest-server/src/tickets/ticket-status.policy.ts",
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

test("handoff API uses the backend endpoint and unwraps its actual counts", async () => {
  const calls = [];
  const expected = {
    userId: 2,
    replacementId: 3,
    reportsTransferred: 4,
    approvalsTransferred: 5,
  };
  const load = createSourceLoader({
    "@/lib/axios": {
      api: {
        patch: async (...args) => {
          calls.push(args);
          return { data: { data: expected } };
        },
      },
    },
  });
  const { handoffUserApi } = load("features/users/api.ts");
  assert.deepEqual(await handoffUserApi(2, { replacementId: 3 }), expected);
  assert.deepEqual(calls, [["/users/2/handoff", { replacementId: 3 }]]);
});

test("lifecycle mutations refresh affected caches on success and failure without optimistic handoff", async () => {
  const invalidated = [];
  const load = createSourceLoader({
    "@tanstack/react-query": {
      useMutation: (options) => options,
      useQueryClient: () => ({
        invalidateQueries: async ({ queryKey }) => {
          invalidated.push(queryKey);
        },
      }),
    },
    "@/features/auth/hooks": { authQueryKeys: { me: ["auth", "me"] } },
    "./api": {
      handoffUserApi: async (id, input) => ({ userId: id, ...input }),
    },
  });
  const hooks = load("features/users/hooks.ts");
  for (const name of [
    "useHandoffUser",
    "useUpdateUser",
    "useChangeUserStatus",
    "useChangeAccountLock",
  ]) {
    const mutation = hooks[name]();
    assert.equal(mutation.onMutate, undefined);
    for (const error of [null, new Error("Conflict")]) {
      invalidated.length = 0;
      await mutation.onSettled(undefined, error);
      assert.deepEqual(invalidated, [
        ["users"],
        ["auth", "me"],
        ["leave-requests"],
        ["tickets"],
        ["assets"],
        ["dashboard"],
      ]);
    }
  }
  assert.deepEqual(
    await hooks
      .useHandoffUser()
      .mutationFn({ id: 2, input: { replacementId: 3 } }),
    { userId: 2, replacementId: 3 },
  );
});

test("handoff form requires explicit selection and confirmation, blocks duplicate submit and stale recipients", async () => {
  const state = [];
  let cursor = 0;
  const Select = () => null;
  const calls = [];
  const load = createSourceLoader({
    react: {
      useState: (initial) => {
        const slot = cursor++;
        if (!(slot in state)) state[slot] = initial;
        return [
          state[slot],
          (value) => {
            state[slot] = value;
          },
        ];
      },
    },
    "next/link": () => null,
    "@/components/ui/button": { Button: () => null },
    "@/components/ui/label": { Label: () => null },
    "@/components/ui/select": {
      Select,
      SelectContent: () => null,
      SelectItem: () => null,
      SelectTrigger: () => null,
      SelectValue: () => null,
    },
  });
  const { UserHandoffForm } = load(
    "features/users/components/user-handoff-form.tsx",
  );
  const source = {
    id: 2,
    name: "Source",
    role: "MANAGER",
    isActive: true,
    isLocked: false,
  };
  const target = { ...source, id: 3, name: "Target" };
  let props = {
    user: source,
    users: [source, target],
    isSubmitting: false,
    error: null,
    onSubmit: async (id) => {
      calls.push(id);
    },
    onCancel() {},
  };
  const render = () => {
    cursor = 0;
    return UserHandoffForm(props);
  };
  const nodes = (element) =>
    !element || typeof element !== "object"
      ? []
      : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
  const submit = async () => render().props.onSubmit({ preventDefault() {} });
  await submit();
  assert.deepEqual(calls, []);
  nodes(render())
    .find((node) => node.type === Select)
    .props.onValueChange("3");
  await submit();
  assert.deepEqual(calls, []);
  nodes(render())
    .find((node) => node.type === "input")
    .props.onChange({ target: { checked: true } });
  props = { ...props, isSubmitting: true };
  await submit();
  assert.deepEqual(calls, []);
  props = {
    ...props,
    isSubmitting: false,
    users: [source, { ...target, isLocked: true }],
  };
  await submit();
  assert.deepEqual(calls, []);
  props = { ...props, users: [source, target] };
  await submit();
  assert.deepEqual(calls, [3]);
  nodes(render())
    .find((node) => node.type === Select)
    .props.onValueChange("3");
  await submit();
  assert.deepEqual(
    calls,
    [3],
    "changing selection requires fresh confirmation",
  );
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

test("knowledge suggestion requests respect API limits without changing the draft", () => {
  const { prepareKnowledgeSuggestionInput } = createSourceLoader()("features/knowledge/suggestions.ts");
  const input = { title: 'x'.repeat(200), description: 'y'.repeat(15000) };
  const request = prepareKnowledgeSuggestionInput(input);
  assert.equal(request.title.length, 150);
  assert.equal(request.description.length, 5000);
  assert.equal(input.description.length, 15000);
  assert.equal(prepareKnowledgeSuggestionInput({ title: '  ', description: '' }), null);
  assert.deepEqual(prepareKnowledgeSuggestionInput({ title: '', description: ' VPN timeout ' }), { title: 'VPN timeout', description: 'VPN timeout' });
});

test("knowledge suggestion queries use normalized input and pass cancellation to Axios", async () => {
  const calls = [];
  const load = createSourceLoader({
    '@tanstack/react-query': { useQuery: options => options },
    '@/lib/axios': { api: { post: async (url, body, options) => { calls.push({ url, body, options }); return { data: { data: [] } }; } } },
  });
  const { useSuggestKnowledgeArticles } = load('features/knowledge/hooks.ts');
  const empty = useSuggestKnowledgeArticles({ title: ' ' });
  assert.equal(empty.enabled, false);
  const controller = new AbortController();
  const options = useSuggestKnowledgeArticles({ title: ' VPN ', description: ' x ' });
  await options.queryFn({ signal: controller.signal });
  assert.deepEqual(calls, [{ url: '/knowledge/suggest-for-ticket', body: { title: 'VPN', description: 'x' }, options: { signal: controller.signal } }]);
  assert.equal(options.refetchOnWindowFocus, false);
});
