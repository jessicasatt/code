// Vitest runs in plain Node, not a bundler that respects the "server-only"
// package's client/server export conditions, so importing it directly would
// always throw. This stub (aliased in vitest.config.ts) makes it a no-op for
// tests, which is safe: nothing under test ever runs in a browser bundle.
export {};
