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
