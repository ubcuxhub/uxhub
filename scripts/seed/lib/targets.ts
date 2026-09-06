/**
 * Which database the seed writes to, and what it is allowed to do there.
 *
 * The target used to be implicit — whatever `NEXT_PUBLIC_SUPABASE_URL` happened
 * to hold — which made a stale `.env.local` the difference between seeding a
 * throwaway local database and rewriting the deployed one. It is now chosen
 * explicitly with `--target`, and each target validates that its URL actually
 * looks like the environment it claims to be, so a mispaste fails loudly
 * instead of silently hitting the wrong project.
 *
 * The two targets exist for different reasons and get different powers:
 *
 * - `local` is disposable, so the seed reconciles it fully — it deletes rows the
 *   seed data no longer describes.
 * - `prod` holds real data, so the seed only ever adds and updates. It writes
 *   demo events for admins to work with while the student-facing events feature
 *   is unlaunched, and it never writes user fixtures.
 */

export type SeedTarget = "local" | "prod";

export const SEED_TARGETS: SeedTarget[] = ["local", "prod"];

export interface TargetPolicy {
  /** Delete seed-owned rows the data no longer describes. */
  prune: boolean;
  /** Write auth users, profiles, purchases, and registrations. */
  users: boolean;
  /**
   * Force every seeded event to `draft`.
   *
   * The public RLS policy on `events` is `using (status = 'active')`, so an
   * active row stays readable through the anon API even while the
   * `studentEvents` flag hides every page that renders it. Draft rows are
   * invisible to that policy and fully visible to `admin_select_all_events`,
   * which is exactly the audience prod demo data is for.
   */
  forceDraft: boolean;
}

export const TARGET_POLICIES: Record<SeedTarget, TargetPolicy> = {
  local: { prune: true, users: true, forceDraft: false },
  prod: { prune: false, users: false, forceDraft: true },
};

/** Env var names each target reads its connection from. */
export const TARGET_ENV_KEYS: Record<SeedTarget, { url: string; secretKey: string }> = {
  local: {
    url: "NEXT_PUBLIC_SUPABASE_URL",
    secretKey: "SUPABASE_SECRET_KEY",
  },
  // Deliberately not `NEXT_PUBLIC_*`: the dev server reads the same
  // `.env.local`, and anything with that prefix is inlined into the client
  // bundle. These are script-only.
  prod: {
    url: "SEED_PROD_SUPABASE_URL",
    secretKey: "SEED_PROD_SUPABASE_SECRET_KEY",
  },
};

export interface ResolvedTarget {
  target: SeedTarget;
  url: string;
  secretKey: string;
  policy: TargetPolicy;
}

export function isLocalHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

export function parseTarget(value: string): SeedTarget {
  if (value === "local" || value === "prod") return value;

  throw new Error(
    `Unknown --target "${value}". Supported: ${SEED_TARGETS.join(", ")}`
  );
}

/**
 * Reads the target's credentials and checks the URL matches the target's shape.
 *
 * Kept free of I/O so the rules can be tested directly: `env` is passed in
 * rather than read from `process.env`.
 */
export function resolveTarget(
  target: SeedTarget,
  env: Record<string, string | undefined>
): ResolvedTarget {
  const keys = TARGET_ENV_KEYS[target];
  const url = env[keys.url]?.trim();
  const secretKey = env[keys.secretKey]?.trim();

  if (!url || !secretKey) {
    throw new Error(
      `Missing ${keys.url} or ${keys.secretKey} for --target=${target}.\n` +
        `  Add both to .env.local. Run via \`pnpm seed\`, which loads it with --env-file.`
    );
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`${keys.url} is not a valid URL: "${url}"`);
  }

  const local = isLocalHost(url);

  if (target === "local" && !local) {
    throw new Error(
      `--target=local expects a local Supabase, but ${keys.url} points at ${host}.\n` +
        `  This script uses the service-role key and bypasses RLS. Check .env.local,\n` +
        `  or use --target=prod if you meant the deployed project.`
    );
  }

  if (target === "prod" && local) {
    throw new Error(
      `--target=prod expects the deployed Supabase, but ${keys.url} points at ${host}.\n` +
        `  Check ${keys.url} in .env.local.`
    );
  }

  return { target, url, secretKey, policy: TARGET_POLICIES[target] };
}
