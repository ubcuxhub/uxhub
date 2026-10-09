import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Integration tests need a local Supabase, which CI's `verify` job does not
    // start. They have their own project in `vitest.integration.config.ts`.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
