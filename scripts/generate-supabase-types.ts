/**
 * Regenerates `src/lib/supabase/database.types.ts` from the local Supabase,
 * so types come from `supabase/migrations` rather than from whatever the
 * hosted project has had pushed to it. CI runs this after applying every
 * migration and fails if the committed file differs.
 *
 * It asks the local `postgres-meta` service, the same generator the hosted
 * project uses, rather than `supabase gen types --local`: the CLI's built-in
 * generator emits unformatted output with a different `Json` type and no
 * `__InternalSupabase` block, which does not type-check against this codebase.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUTPUT = "src/lib/supabase/database.types.ts";

/**
 * The hosted project's PostgREST version, which supabase-js reads from the
 * generated `__InternalSupabase` block to decide which query features to type.
 * The local stack runs whatever version the CLI pins, so this stays fixed to
 * production rather than following it. Only the major version changes typing.
 */
const POSTGREST_VERSION = "14.5";

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

const host = new URL(status.API_URL).hostname;
if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
  throw new Error(
    `Refusing to generate types from ${status.API_URL}: only a local Supabase is allowed.`
  );
}

const params = new URLSearchParams({
  included_schemas: "public",
  detect_one_to_one_relationships: "true",
  postgrest_version: POSTGREST_VERSION,
});
const response = await fetch(
  `${status.API_URL}/pg/generators/typescript?${params}`,
  {
    headers: {
      apikey: status.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`,
    },
  }
);
if (!response.ok) {
  throw new Error(
    `postgres-meta returned ${response.status}. Is the \`meta\` service ` +
      `running? ${await response.text()}`
  );
}

writeFileSync(OUTPUT, await response.text());
console.log(`Wrote ${OUTPUT}`);
