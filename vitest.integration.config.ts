import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests: Vitest against the local Supabase.
 *
 * Separate from `vitest.config.ts` because these need a database. The default
 * suite runs in CI's `verify` job, which has none, so `vitest.config.ts`
 * excludes this pattern and these run in the `build` job instead, after the RLS
 * suite, on the throwaway database that job already starts.
 *
 * Run with `pnpm test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.integration.test.ts"],
    // Fixtures are scoped by a per-test tag rather than rolled back, so files
    // may run in parallel, but the cases inside one file share a context and
    // run in order.
    sequence: { concurrent: false },
    // A round trip to Postgres through PostgREST is slower than a mocked call,
    // and CI's database is cold on the first query.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
