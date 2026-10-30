const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
const merge = projectRequire("deepmerge");

test("ordinary nested and array configuration merges still work", () => {
  assert.deepEqual(
    merge(
      { options: { enabled: true }, files: ["a"] },
      { options: { count: 2 }, files: ["b"] },
    ),
    { options: { enabled: true, count: 2 }, files: ["a", "b"] },
  );
});

test("npm tooling rejects prototype poisoning across the vulnerable target shapes", () => {
  const payload = JSON.parse('{"__proto__":{"officeflowPoisoned":true}}');
  for (const target of [
    Object.create(null),
    null,
    JSON.parse('{"__proto__":{}}'),
  ]) {
    assert.throws(() => merge(target, payload), { code: "ERR_PROTO_ACCESS" });
  }
  assert.throws(
    () =>
      merge(
        { session: null },
        JSON.parse('{"session":{"__proto__":{"officeflowPoisoned":true}}}'),
      ),
    { code: "ERR_PROTO_ACCESS" },
  );
  assert.equal({}.officeflowPoisoned, undefined);
});
