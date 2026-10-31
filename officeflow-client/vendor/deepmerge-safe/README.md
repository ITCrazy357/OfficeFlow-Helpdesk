# OfficeFlow deepmerge security fork

Based on deepmerge 4.3.1, dist/cjs.js, under its original MIT license (license.txt). Original SHA-256: 2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d.

The local patch skips the literal __proto__ key in both the target-copy and source-merge loops before any property read or assignment. This covers null targets, null-prototype targets, own __proto__ properties, and nested object/array clones (GHSA-gcqx-w48m-w2h4). Other keys, symbols, merge options and public exports retain upstream behavior.

This is a private maintained fork, not an upstream patched release. Both applications carry identical copies because the backend Docker build uses its own directory as context. Keep these copies synchronized; run the shared prototype-safety tests without relying on Node's --disable-proto flag. Review upstream changes before replacing this fork.
