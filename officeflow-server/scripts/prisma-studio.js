const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

const caCertPath = resolve(process.cwd(), "certs", "ca.pem");
const env = { ...process.env };

if (existsSync(caCertPath)) {
  env.NODE_EXTRA_CA_CERTS = caCertPath;
}

const child = spawn(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "studio", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
