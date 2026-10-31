# Glob compatibility export

Uses the unmodified glob 14.0.2 engine through the `glob-modern` npm alias.
It supplies the callable/callback export and `.sync` alias needed by coverage
tooling as well as modern named exports. No glob 7 traversal implementation is
retained. The package is private and is not published.

Legacy callable, callback, promisified and `.sync` paths default to POSIX
separators, matching glob 7 on Windows. Modern named exports retain glob 14
behavior. Callers can explicitly override `posix`. The engine retains its
upstream BlueOak-1.0.0 license.
