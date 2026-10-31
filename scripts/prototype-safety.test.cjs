const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const { spawnSync } = require("node:child_process");

const projectRequire = createRequire(path.join(process.cwd(), "package.json"));
const merge = projectRequire("deepmerge");

test("every locked deepmerge caller resolves to the attributed security fork", () => {
  const lock = projectRequire("./package-lock.json");
  const entries = Object.entries(lock.packages).filter(([key]) =>
    /(^|\/)node_modules\/deepmerge$/.test(key),
  );
  assert.ok(entries.length > 0);
  for (const [key, entry] of entries) {
    assert.equal(entry.link, true, key);
    assert.equal(entry.resolved, "vendor/deepmerge-safe", key);
  }
  assert.equal(
    projectRequire("deepmerge/package.json").name,
    "@officeflow/deepmerge-safe",
  );
});

test("ordinary merges preserve upstream behavior, symbols and options", () => {
  const symbol = Symbol("config");
  const date = new Date(0);
  const result = merge(
    { options: { enabled: true }, files: ["a"], [symbol]: { first: 1 } },
    { options: { count: 2 }, files: ["b"], [symbol]: { second: 2 }, date },
  );
  assert.deepEqual(result, {
    options: { enabled: true, count: 2 },
    files: ["a", "b"],
    [symbol]: { first: 1, second: 2 },
    date,
  });
  assert.equal(result.date, date);
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  const source = { options: { nested: true } };
  assert.equal(merge({}, source, { clone: false }).options, source.options);
  assert.deepEqual(
    merge(
      { files: ["a"] },
      { files: ["b"] },
      { arrayMerge: (_, values) => values },
    ),
    { files: ["b"] },
  );
  assert.deepEqual(
    merge(
      { options: { a: 1 } },
      { options: { b: 2 } },
      {
        customMerge: (key) =>
          key === "options" ? (_, value) => value : undefined,
      },
    ),
    { options: { b: 2 } },
  );
  assert.deepEqual(
    merge(
      {},
      JSON.parse('{"constructor":{"prototype":{"officeflowPoisoned":true}}}'),
    ),
    {},
  );
  assert.equal({}.officeflowPoisoned, undefined);
});

function assertSafe(result) {
  if (Array.isArray(result)) {
    for (const entry of result) assertSafe(entry);
  } else if (result && typeof result === "object") {
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(Object.hasOwn(result, "__proto__"), false);
    assert.equal(result.officeflowPoisoned, undefined);
    for (const value of Object.values(result)) assertSafe(value);
  }
  assert.equal({}.officeflowPoisoned, undefined);
}

function assertPoisoningBlocked() {
  const poison = () =>
    JSON.parse('{"__proto__":{"officeflowPoisoned":true},"safe":1}');
  for (const target of [Object.create(null), null, poison()]) {
    const merged = merge(target, poison());
    assertSafe(merged);
    assert.equal(merged.safe, 1);
  }
  assertSafe(merge(poison(), {}));
  assertSafe(merge({ session: null }, { session: poison() }));
  assertSafe(merge([], [poison()]));
  assertSafe(merge([poison()], []));
  assertSafe(merge.all([poison(), { nested: poison() }]));
  const trap = Object.defineProperty({}, "__proto__", {
    enumerable: true,
    get() {
      throw new Error("unsafe key was read");
    },
  });
  assert.deepEqual(merge(trap, { safe: 1 }), { safe: 1 });
  assert.deepEqual(merge(Object.create(null), trap), {});
}

test(
  "the patched algorithm blocks poisoned target/source shapes",
  assertPoisoningBlocked,
);

test("the patch works without NODE_OPTIONS or --disable-proto", () => {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_TEST_CONTEXT;
  const program = `
    const assert = require('node:assert/strict');
    const merge = require(${JSON.stringify(projectRequire.resolve("deepmerge"))});
    const control = {};
    control.__proto__ = { controlSetterWorks: true };
    assert.equal(control.controlSetterWorks, true);
    const assertSafe = ${assertSafe.toString()};
    const check = ${assertPoisoningBlocked.toString()};
    check();
    process.stdout.write('patch-verified');
  `;
  const result = spawnSync(process.execPath, ["-e", program], {
    env,
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "patch-verified");
});
