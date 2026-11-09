import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const projectRequire = createRequire(path.join(root, "package.json"));
const axiosBrowser = path.join(
  path.dirname(projectRequire.resolve("axios/package.json")),
  "dist/axios.min.js",
);

function applicationModules() {
  const sources: Record<string, string> = {};
  for (const [name, file] of Object.entries({
    client: "axios.ts",
    "./token": "token.ts",
    "./session-lock": "session-lock.ts",
  })) {
    const filename = path.join(root, "src/lib", file);
    if (existsSync(filename))
      sources[name] = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      }).outputText;
  }
  return `(() => {
    const sources = ${JSON.stringify(sources)};
    const cache = {};
    function load(name) {
      if (name === 'axios') return window.axios;
      if (cache[name]) return cache[name].exports;
      const mod = { exports: {} }; cache[name] = mod;
      new Function('require', 'module', 'exports', 'process', sources[name])(
        load, mod, mod.exports, { env: { NEXT_PUBLIC_API_URL: '/backend-api' } });
      return mod.exports;
    }
    window.sessionTest = load('client');
  })();`;
}

type SessionPage = Window & {
  sessionTest: {
    api: { get(url: string): Promise<{ status: number }> };
    requestSession(config: {
      method: string;
      url: string;
    }): Promise<{ status: number }>;
  };
};

async function fixture(context: BrowserContext, delay = 50) {
  const state = {
    cookie: "initial-fixture",
    token: "",
    refreshes: 0,
    reuseDetected: false,
    revoked: false,
    refreshing: false,
    logoutDuringRefresh: false,
  };
  const used = new Set<string>();
  await context.addCookies([
    {
      name: "officeflow_refresh",
      value: state.cookie,
      url: "http://localhost:3016",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await context.route("**/session-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Session fixture</title>",
    }),
  );
  await context.route("**/backend-api/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    let status = 200;
    let data: unknown = { id: 1 };
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (endpoint.endsWith("/auth/refresh")) {
      state.refreshes++;
      state.refreshing = true;
      const sent = request
        .headers()
        .cookie?.match(/(?:^|;\s*)officeflow_refresh=([^;]+)/)?.[1];
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (state.revoked || sent !== state.cookie) {
        if (sent && used.has(sent)) state.reuseDetected = true;
        state.revoked = true;
        status = 401;
        headers["set-cookie"] =
          "officeflow_refresh=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
      } else {
        used.add(sent);
        state.cookie = `refresh-fixture-${state.refreshes}`;
        state.token = `access-fixture-${state.refreshes}`;
        data = { accessToken: state.token };
        headers["set-cookie"] =
          `officeflow_refresh=${state.cookie}; Path=/; HttpOnly; SameSite=Strict`;
      }
      state.refreshing = false;
    } else if (endpoint.endsWith("/auth/logout")) {
      state.logoutDuringRefresh = state.refreshing;
      state.revoked = true;
      headers["set-cookie"] =
        "officeflow_refresh=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
    } else if (endpoint.endsWith("/auth/login")) {
      data = { accessToken: "manual-login-fixture" };
    } else if (
      state.revoked ||
      request.headers().authorization !== `Bearer ${state.token}`
    )
      status = 401;
    await route.fulfill({ status, headers, body: JSON.stringify({ data }) });
  });
  return state;
}

async function load(page: Page) {
  await page.goto("/session-test");
  await page.addScriptTag({ path: axiosBrowser });
  await page.addScriptTag({ content: applicationModules() });
}

function me(page: Page) {
  return page.evaluate(async () => {
    try {
      return (await (window as unknown as SessionPage).sessionTest.api.get("/auth/me"))
        .status;
    } catch (error) {
      return (error as { response?: { status: number } }).response?.status ?? 0;
    }
  });
}

test("two tabs sharing one cookie recover without token reuse or logout", async ({
  context,
}) => {
  const state = await fixture(context);
  const pages = [await context.newPage(), await context.newPage()];
  await Promise.all(pages.map(load));
  for (let round = 0; round < 4; round++)
    expect(await Promise.all(pages.map(me))).toEqual([200, 200]);
  expect(state.reuseDetected).toBe(false);
  expect(state.revoked).toBe(false);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "officeflow_refresh",
    )?.value,
  ).toBe(state.cookie);
});

test("session restoration completes before logout from another tab clears the shared cookie", async ({
  context,
}) => {
  const state = await fixture(context, 250);
  const [first, second] = [await context.newPage(), await context.newPage()];
  await Promise.all([load(first), load(second)]);
  const restoration = first.evaluate(
    async () =>
      (
        await (window as unknown as SessionPage).sessionTest.requestSession({
          method: "get",
          url: "/auth/me",
        })
      ).status,
  );
  await expect.poll(() => state.refreshing).toBe(true);
  const logout = second.evaluate(
    async () =>
      (
        await (window as unknown as SessionPage).sessionTest.requestSession({
          method: "post",
          url: "/auth/logout",
        })
      ).status,
  );
  expect(await restoration).toBe(200);
  expect(await logout).toBe(200);
  expect(state.logoutDuringRefresh).toBe(false);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "officeflow_refresh",
    ),
  ).toBeUndefined();
  expect(await me(first)).toBe(401);
});

test("a browser without cross-tab locks does not rotate cookies and still permits manual login", async ({
  context,
  page,
}) => {
  const state = await fixture(context);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "locks", { value: undefined });
  });
  await load(page);
  const error = await page.evaluate(async () => {
    try {
      await (window as unknown as SessionPage).sessionTest.api.get("/auth/me");
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(error).toContain("cập nhật trình duyệt");
  expect(state.refreshes).toBe(0);
  expect(
    await page.evaluate(
      async () =>
        (
          await (window as unknown as SessionPage).sessionTest.requestSession({
            method: "post",
            url: "/auth/login",
          })
        ).status,
    ),
  ).toBe(200);
});
