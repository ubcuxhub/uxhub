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
 *
 * The output depends on the postgres-meta version, so it refuses to run against
 * a stack whose postgres-meta differs from the one the lockfile's CLI pins,
 * which is the version CI runs. `supabase start` leaves an already running
 * stack on whatever images it was started with, so an old stack would
 * otherwise produce a file CI rejects.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUTPUT = "src/lib/supabase/database.types.ts";

/**
 * The hosted project's PostgREST version, which supabase-js reads from the
 * generated `__InternalSupabase` block to decide which query features to type.
 * The local stack runs whatever version the CLI pins, so this stays fixed to
 * production rather than following it. Only the major version changes typing.
 */
const POSTGREST_VERSION = "14.5";

function run(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: "utf8" });
}

const result = run("pnpm", ["exec", "supabase", "status", "-o", "json"]);
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

const services = run("pnpm", ["exec", "supabase", "services", "-o", "json"]);
const pinnedMeta = services.status === 0
  ? (JSON.parse(services.stdout) as { name: string; local: string }[]).find(
      (service) => service.name === "supabase/postgres-meta"
    )?.local
  : undefined;
const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(
  readFileSync("supabase/config.toml", "utf8")
)?.[1];
const runningImage = run("docker", [
  "inspect",
  `supabase_pg_meta_${projectId}`,
  "--format",
  "{{.Config.Image}}",
]).stdout.trim();
if (!pinnedMeta || !runningImage.endsWith(`:${pinnedMeta}`)) {
  throw new Error(
    `The local postgres-meta (${runningImage || "not running"}) is not the ` +
      `version the Supabase CLI pins (${pinnedMeta ?? "unknown"}), so the ` +
      "types would not match CI's. Restart the stack to pick it up: " +
      "`pnpm exec supabase stop && pnpm exec supabase start`."
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
