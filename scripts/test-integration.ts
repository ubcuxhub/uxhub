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

interface Credentials {
  url: string;
  anonKey: string;
  secretKey: string;
  jwtSecret: string;
}

function credentialsFromEnv(): Credentials | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  return url && anonKey && secretKey && jwtSecret
    ? { url, anonKey, secretKey, jwtSecret }
    : null;
}

function credentialsFromCli(): Credentials {
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
    ANON_KEY?: string;
    SERVICE_ROLE_KEY?: string;
    JWT_SECRET?: string;
  };

  if (
    !status.API_URL ||
    !status.ANON_KEY ||
    !status.SERVICE_ROLE_KEY ||
    !status.JWT_SECRET
  ) {
    throw new Error(
      "`supabase status` reported no API URL, anon key, service-role key, or " +
        "JWT secret. Start the local stack with `pnpm supabase:local`."
    );
  }

  return {
    url: status.API_URL,
    anonKey: status.ANON_KEY,
    secretKey: status.SERVICE_ROLE_KEY,
    jwtSecret: status.JWT_SECRET,
  };
}

const { url, anonKey, secretKey, jwtSecret } =
  credentialsFromEnv() ?? credentialsFromCli();

// The app's own modules, such as `supabaseAdmin`, read the NEXT_PUBLIC_* names
// rather than the harness's, so this is the one place that can stop a shell
// that exports the hosted project's credentials.
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
  throw new Error(
    `Integration tests refuse to run against ${url}: only a local Supabase is allowed.`
  );
}

const child = spawn(
  "pnpm",
  ["exec", "vitest", "run", "--config", "vitest.integration.config.ts", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      INTEGRATION_SUPABASE_URL: url,
      INTEGRATION_SUPABASE_SECRET_KEY: secretKey,
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SECRET_KEY: secretKey,
      SUPABASE_JWT_SECRET: jwtSecret,
    },
  }
);

child.on("exit", (code) => process.exit(code ?? 1));
