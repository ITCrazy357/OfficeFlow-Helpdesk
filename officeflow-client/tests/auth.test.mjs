import assert from "node:assert/strict";
import { test } from "node:test";
import { axios, createSourceLoader, setupApi, rejectStatus } from "./helpers/source-loader.mjs";

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

test("new passwords enforce UTF-8 byte limits across self-service and admin forms", () => {
  const load = createSourceLoader();
  const auth = load("features/auth/schemas.ts");
  const users = load("features/users/schemas.ts");
  for (const [accepted, rejected] of [
    ["a".repeat(72), "a".repeat(73)],
    ["á".repeat(36), "á".repeat(37)],
    ["🔐".repeat(18), "🔐".repeat(19)],
  ]) {
    for (const [password, expected] of [
      [accepted, true],
      [rejected, false],
    ]) {
      assert.equal(
        auth.changePasswordSchema.safeParse({
          currentPassword: "legacy-password",
          newPassword: password,
          confirmPassword: password,
        }).success,
        expected,
      );
      assert.equal(
        auth.resetForgottenPasswordSchema.safeParse({
          newPassword: password,
          confirmPassword: password,
        }).success,
        expected,
      );
      assert.equal(
        users.resetPasswordSchema.safeParse({
          password,
          confirmPassword: password,
        }).success,
        expected,
      );
      assert.equal(
        users.userFormSchema.safeParse({
          name: "Fixture",
          email: "fixture@test.invalid",
          role: "EMPLOYEE",
          departmentId: "1",
          password,
        }).success,
        expected,
      );
    }
  }
  const legacy = "á".repeat(40);
  assert.equal(
    auth.loginSchema.safeParse({
      email: "fixture@test.invalid",
      password: legacy,
    }).success,
    true,
  );
  assert.equal(
    auth.changePasswordSchema.safeParse({
      currentPassword: legacy,
      newPassword: "independent-new-password",
      confirmPassword: "independent-new-password",
    }).success,
    true,
  );
  assert.equal(
    users.userFormSchema.safeParse({
      name: "Fixture",
      email: "fixture@test.invalid",
      role: "EMPLOYEE",
      departmentId: "1",
      password: "",
    }).success,
    true,
  );
});
