// Test-only: Next's bundler aliases the "server-only" marker package to an
// empty module for server code, but plain Node (node --test) cannot resolve
// it. Map it to the same empty module Next ships, so route handlers that
// import server-only code (AI, uploads) load in integration tests.
//
// Both resolvers are covered: tsx loads the app's TypeScript as CommonJS
// (Module._resolveFilename), and ESM imports go through registerHooks.
import Module, { createRequire, registerHooks } from "node:module";

const EMPTY = createRequire(import.meta.url).resolve(
  "next/dist/compiled/server-only/empty.js",
);

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...rest) {
  if (request === "server-only") return EMPTY;
  return originalResolveFilename.call(this, request, ...rest);
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return nextResolve("next/dist/compiled/server-only/empty.js", context);
    }
    return nextResolve(specifier, context);
  },
});
