const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

const project = createRequire(path.join(process.cwd(), "package.json"));
const eslintRequire = createRequire(project.resolve("@eslint/eslintrc"));
const match = eslintRequire("minimatch");

test("lockfile contains only root compatibility links and no legacy engines", () => {
  const lock = project("./package-lock.json");
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (/(^|\/)node_modules\/(glob|minimatch)$/.test(key)) {
      assert.equal(entry.link, true, key);
      assert.match(entry.resolved, /^vendor\/(glob|minimatch)-compat$/, key);
      assert.ok(
        fs.existsSync(path.join(process.cwd(), entry.resolved, "package.json")),
        key,
      );
    }
    assert.doesNotMatch(
      key,
      /^node_modules\/.+\/vendor\/(glob|minimatch)-compat/,
      key,
    );
  }
});

test("legacy callers use the callable export of the patched engine", () => {
  assert.equal(typeof match, "function");
  assert.equal(match, project("minimatch-modern").minimatch);
  assert.equal(project("minimatch-modern/package.json").version, "11.0.1");
  for (const [file, pattern, options, expected] of [
    ["src/main.ts", "**/*.ts", {}, true],
    ["src/main.js", "**/*.ts", {}, false],
    ["src/main.spec.ts", "**/*.{spec,test}.ts", {}, true],
    [".env", "*", {}, false],
    [".env", "*", { dot: true }, true],
    ["src/main.ts", "!**/*.js", {}, true],
    ["src/main.ts", "**/*.TS", { nocase: true }, true],
  ])
    assert.equal(match(file, pattern, options), expected);
  assert.deepEqual(match.braceExpand("a{b,c}d"), ["abd", "acd"]);
  assert.deepEqual(match.match(["a.ts", "a.js"], "*.ts"), ["a.ts"]);
  assert.deepEqual(["a.ts", "a.js"].filter(match.filter("*.ts")), ["a.ts"]);
  assert.equal(match.defaults({ dot: true })(".env", "*"), true);
  const matcher = new match.Minimatch("**/*.ts");
  assert.equal(matcher.match("src/main.ts"), true);
  assert.equal(matcher.set[0][0], match.GLOBSTAR);
  assert.deepEqual(matcher.globSet, ["**/*.ts"]);
});

test("modern ESM callers retain named exports", async () => {
  const named = await import(
    pathToFileURL(eslintRequire.resolve("minimatch")).href
  );
  assert.equal(named.minimatch, match);
  assert.equal(named.Minimatch, match.Minimatch);
});

let coverageRequire;
try {
  coverageRequire = createRequire(project.resolve("test-exclude"));
} catch {}
test("legacy glob discovery retains its file selection on the patched engine", async () => {
  const glob = (coverageRequire || project)("glob");
  assert.equal(typeof glob, "function");
  assert.equal(glob.glob, project("glob-modern").glob);
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "officeflow-legacy-"),
  );
  try {
    fs.mkdirSync(path.join(directory, "src"));
    for (const file of ["main.js", "main.spec.js", "notes.txt"])
      fs.writeFileSync(path.join(directory, "src", file), "");
    assert.deepEqual(
      glob.sync("**/*.js", { cwd: directory, ignore: "**/*.spec.js" }),
      ["src/main.js"],
    );
    assert.deepEqual(
      await require("node:util").promisify(glob)("**/*.js", {
        cwd: directory,
        ignore: "**/*.spec.js",
      }),
      ["src/main.js"],
    );
    const callbackFiles = await new Promise((resolve, reject) =>
      glob(
        "**/*.js",
        { cwd: directory, ignore: "**/*.spec.js" },
        (error, files) => (error ? reject(error) : resolve(files)),
      ),
    );
    assert.deepEqual(callbackFiles, ["src/main.js"]);
  } finally {
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir()),
    );
    assert.ok(path.basename(directory).startsWith("officeflow-legacy-"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
