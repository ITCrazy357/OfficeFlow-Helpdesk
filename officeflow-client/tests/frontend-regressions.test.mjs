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
function createSourceLoader() {
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
      },
    }).outputText;
    const requireSource = (specifier) => {
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
