import assert from "node:assert/strict";
import { test } from "node:test";
import { axios, createSourceLoader, setupApi, rejectStatus } from "./helpers/source-loader.mjs";

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
