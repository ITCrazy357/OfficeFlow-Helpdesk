const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const caCertificate = path.join(projectRoot, 'certs', 'ca.pem');
const prismaCli = require.resolve('prisma/build/index.js');

const studio = spawn(process.execPath, [prismaCli, 'studio'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_EXTRA_CA_CERTS: caCertificate,
  },
  stdio: 'inherit',
});

studio.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
