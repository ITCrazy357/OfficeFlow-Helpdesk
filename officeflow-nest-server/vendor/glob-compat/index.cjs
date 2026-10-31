const modern = require("glob-modern");
const { promisify } = require("node:util");
function glob(pattern, options, callback) {
  if (typeof options === "function") { callback = options; options = {}; }
  const result = modern.glob(pattern, { posix: true, ...options });
  if (callback) result.then(files => callback(null, files), error => callback(error));
  return result;
}
glob[promisify.custom] = (pattern, options) => modern.glob(pattern, { posix: true, ...options });
module.exports = glob;
module.exports.glob = modern.glob;
module.exports.sync = (pattern, options) => modern.globSync(pattern, { posix: true, ...options });
module.exports.globSync = modern.globSync;
module.exports.Glob = modern.Glob;
module.exports.hasMagic = modern.hasMagic;
module.exports.escape = modern.escape;
module.exports.unescape = modern.unescape;
module.exports.iterate = modern.globIterate;
module.exports.iterateSync = modern.globIterateSync;
module.exports.globIterate = modern.globIterate;
module.exports.globIterateSync = modern.globIterateSync;
module.exports.stream = modern.globStream;
module.exports.streamSync = modern.globStreamSync;
module.exports.globStream = modern.globStream;
module.exports.globStreamSync = modern.globStreamSync;
