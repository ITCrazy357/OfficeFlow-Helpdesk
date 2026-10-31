# Minimatch compatibility export

This private adapter retains the callable CommonJS export used by ESLint and
legacy coverage tools. All matching, preprocessing, constructors and helper functions come
from the unmodified upstream minimatch 11.0.1 engine through `minimatch-modern`.
It contains no minimatch 3 implementation and does not suppress npm audit.

The root package pins the npm alias `minimatch-modern`. All minimatch requests
resolve to this compatibility export; both CommonJS and named ESM APIs are
tested. The modern library retains its upstream BlueOak-1.0.0 license.

The removed regex-generation API is not emulated. Old glob traversal is
migrated to the glob compatibility export backed by glob 14, rather than
depending on minimatch 3 regex internals.
