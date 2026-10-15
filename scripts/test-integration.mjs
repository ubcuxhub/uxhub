import { execFileSync, spawnSync } from "node:child_process";

// Read credentials from the local CLI, never from a potentially hosted .env.local.
const status = JSON.parse(execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
const url = new URL(status.API_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Integration tests require local Supabase.");
const result = spawnSync("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_TEST_JWT_SECRET: status.JWT_SECRET },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
