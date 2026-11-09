import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const axios = nativeRequire("axios");
const sourceDirectory = fileURLToPath(new URL("../../src/", import.meta.url));

// Compile the actual client modules in memory; no build artifacts or extra test dependencies.
function createSourceLoader(overrides = {}) {
  const cache = new Map();
  function load(relativePath) {
    const filename = path.resolve(sourceDirectory, relativePath);
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

export { axios, nativeRequire, createSourceLoader, setupApi, rejectStatus };
