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
    // `.claude/**` holds agent worktrees: full checkouts whose copies of the
    // tests would otherwise run here too.
    exclude: [
      ...configDefaults.exclude,
      "**/*.integration.test.ts",
      ".claude/**",
    ],
  },
});
