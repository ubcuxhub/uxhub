/**
 * Runs the integration suite against the local Supabase.
 *
 * CI exports the credentials itself before calling this, so when they are
 * already set this just spawns Vitest. Locally it reads them from
 * `supabase status`, which keeps `pnpm test:integration` a single command and
 * means a developer's `.env.local` — which points at the hosted project — is
 * never consulted.
 */
import { spawn, spawnSync } from "node:child_process";

function credentialsFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && secretKey ? { url, secretKey } : null;
}

function credentialsFromCli() {
  const result = spawnSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      "Could not read the local Supabase status. Start it with " +
        "`pnpm supabase:local`.\n" +
        (result.stderr || result.stdout || "").trim()
    );
  }

  const status = JSON.parse(result.stdout) as {
    API_URL?: string;
    SERVICE_ROLE_KEY?: string;
  };

  if (!status.API_URL || !status.SERVICE_ROLE_KEY) {
    throw new Error(
      "`supabase status` reported no API URL or service-role key. Start the " +
        "local stack with `pnpm supabase:local`."
    );
  }

  return { url: status.API_URL, secretKey: status.SERVICE_ROLE_KEY };
}

const { url, secretKey } = credentialsFromEnv() ?? credentialsFromCli();

const child = spawn(
  "pnpm",
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      INTEGRATION_SUPABASE_URL: url,
      INTEGRATION_SUPABASE_SECRET_KEY: secretKey,
    },
  }
);

child.on("exit", (code) => process.exit(code ?? 1));
