// Keep callable CommonJS and named ESM imports on the same patched engine.
const modern = require("minimatch-modern");
module.exports = modern.minimatch;
module.exports.minimatch = modern.minimatch;
module.exports.Minimatch = modern.Minimatch;
module.exports.GLOBSTAR = modern.GLOBSTAR;
module.exports.filter = modern.filter;
module.exports.defaults = modern.defaults;
module.exports.match = modern.match;
module.exports.braceExpand = modern.braceExpand;
module.exports.sep = modern.sep;
module.exports.escape = modern.escape;
module.exports.unescape = modern.unescape;
