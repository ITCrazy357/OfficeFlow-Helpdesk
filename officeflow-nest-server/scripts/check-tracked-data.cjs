const { execFileSync } = require('node:child_process');
const path = require('node:path');

function findTrackedDataExports(files) {
  return files.filter(
    (file) =>
      /\.sql(?:\.(?:gz|zip|xz|zst|bz2))?$/i.test(file) &&
      !/^officeflow-nest-server\/src\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(
        file,
      ),
  );
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\0')
    .filter(Boolean);
  const exports = findTrackedDataExports(files);
  if (exports.length) {
    console.error(
      'Database exports must stay outside Git. Only Prisma migration SQL is allowed:',
    );
    for (const file of exports) console.error(JSON.stringify(file));
    process.exitCode = 1;
  } else {
    console.log('No tracked database exports found.');
  }
}

module.exports = { findTrackedDataExports };
