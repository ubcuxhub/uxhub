/**
 * Seeds a local Supabase database with realistic UX Hub data.
 *
 *   pnpm seed                      # seed everything
 *   pnpm seed -- --only=events     # memberships | events | users (comma-separated)
 *   pnpm seed -- --dry-run         # print the plan, write nothing
 *   pnpm seed -- --prune           # delete seed-managed children no longer in the data
 *   pnpm seed -- --allow-remote    # required to target a non-local Supabase
 *
 * Safe to run repeatedly: rows are matched on their natural key (slug for
 * events and membership tiers, name/question for children), so a re-run syncs
 * edits instead of duplicating or erroring. See scripts/seed/lib/reconcile.ts.
 *
 * Table names mirror TABLES in src/lib/supabase-helpers/tables.ts. That module
 * cannot be imported here — the helper tree imports through the `@/*` alias,
 * which Node does not resolve — so keep the two in sync by hand.
 */

import { createClient } from "@supabase/supabase-js";
import {
  addCounts,
  emptyCounts,
  reconcileChildren,
  upsertBySlug,
  type Counts,
  type ReconcileOptions,
} from "./lib/reconcile.ts";
import { membershipTypes } from "./data/membership-types.ts";
import { buildSeedEvents } from "./data/events.ts";
import { buildSeedUsers } from "./data/users.ts";
import { reconcileUserFixtures } from "./lib/reconcile-users.ts";
import { validateUserFixtures } from "./lib/user-fixtures.ts";

const TABLE = {
  membershipTypes: "membership_types",
  events: "events",
  checkInSessions: "check_in_sessions",
  eventApplicationQuestions: "event_application_questions",
} as const;

interface Options extends ReconcileOptions {
  only: Set<string>;
  allowRemote: boolean;
}

function parseArgs(argv: string[]): Options {
  const only = new Set<string>();
  let dryRun = false;
  let prune = false;
  let allowRemote = false;

  for (const arg of argv) {
    // pnpm 10 forwards the `--` separator through to the script rather than
    // consuming it, so `pnpm seed -- --dry-run` arrives with a bare `--`.
    if (arg === "--") continue;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--prune") prune = true;
    else if (arg === "--allow-remote") allowRemote = true;
    else if (arg.startsWith("--only=")) {
      for (const part of arg.slice("--only=".length).split(",")) {
        const trimmed = part.trim();
        if (trimmed) only.add(trimmed);
      }
    } else {
      throw new Error(
        `Unknown argument "${arg}". Supported: --only=, --dry-run, --prune, --allow-remote`
      );
    }
  }

  const known = new Set(["memberships", "events", "users"]);
  for (const target of only) {
    if (!known.has(target)) {
      throw new Error(
        `Unknown --only target "${target}". Supported: ${[...known].join(", ")}`
      );
    }
  }

  return { only, dryRun, prune, allowRemote };
}

function shouldRun(options: Options, target: string): boolean {
  return options.only.size === 0 || options.only.has(target);
}

/**
 * Refuses to run against anything but a local Supabase unless explicitly
 * overridden. This script authenticates with the service-role key, which
 * bypasses RLS entirely, so pointing it at the deployed project by way of a
 * stale .env.local would let it rewrite production rows.
 */
function isLocalTarget(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

function assertAllowedTarget(
  url: string,
  allowRemote: boolean,
  includesUsers: boolean
): void {
  const host = new URL(url).hostname;
  const isLocal = isLocalTarget(url);

  if (!isLocal && includesUsers) {
    throw new Error(
      `Refusing to seed known-password users into non-local Supabase at ${host}.\n` +
        `  User fixtures are local-only. For remote reference data, use\n` +
        `  --only=memberships,events --allow-remote.`
    );
  }

  if (isLocal || allowRemote) {
    if (!isLocal) {
      console.warn(`! Targeting non-local Supabase at ${host} (--allow-remote)\n`);
    }
    return;
  }

  throw new Error(
    `Refusing to seed non-local Supabase at ${host}.\n` +
      `  This script uses the service-role key and bypasses RLS.\n` +
      `  Check NEXT_PUBLIC_SUPABASE_URL in .env.local, or pass --allow-remote if you meant it.`
  );
}

function format(label: string, counts: Counts): string {
  const parts = [`${counts.created} created`, `${counts.updated} updated`];
  if (counts.pruned > 0) parts.push(`${counts.pruned} pruned`);
  return `${label}: ${parts.join(", ")}`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const seedNow = new Date();
  const seedEvents = buildSeedEvents(seedNow);
  const seedUsers = buildSeedUsers(seedEvents, seedNow);
  validateUserFixtures(seedUsers, seedEvents, membershipTypes, seedNow);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n" +
        "  Run via `pnpm seed`, which loads .env.local with --env-file."
    );
  }

  assertAllowedTarget(url, options.allowRemote, shouldRun(options, "users"));

  if (options.dryRun) {
    console.log("Dry run — no writes will be made.\n");
  }

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: string[] = [];

  if (shouldRun(options, "memberships")) {
    const { counts } = await upsertBySlug(
      supabase,
      TABLE.membershipTypes,
      membershipTypes.map((tier) => ({ ...tier, slug: tier.slug })),
      options
    );
    summary.push(format("Membership tiers", counts));
  }

  if (shouldRun(options, "events")) {
    const { idsBySlug, counts: eventCounts } = await upsertBySlug(
      supabase,
      TABLE.events,
      seedEvents.map((seed) => seed.event),
      options
    );
    summary.push(format("Events", eventCounts));

    const sessionCounts = emptyCounts();
    const questionCounts = emptyCounts();

    for (const seed of seedEvents) {
      const eventId = idsBySlug.get(seed.event.slug);

      if (!eventId) {
        // Expected on a dry run against a database where the event does not
        // exist yet: there is no id to hang children off.
        if (options.dryRun) continue;
        throw new Error(`No id returned for event "${seed.event.slug}"`);
      }

      addCounts(
        sessionCounts,
        await reconcileChildren(
          supabase,
          TABLE.checkInSessions,
          "event_id",
          eventId,
          "name",
          seed.checkInSessions,
          options
        )
      );

      addCounts(
        questionCounts,
        await reconcileChildren(
          supabase,
          TABLE.eventApplicationQuestions,
          "event_id",
          eventId,
          "question",
          seed.applicationQuestions,
          options
        )
      );
    }

    summary.push(format("Check-in sessions", sessionCounts));
    summary.push(format("Application questions", questionCounts));
  }

  if (shouldRun(options, "users")) {
    const userSummary = await reconcileUserFixtures(supabase, seedUsers, {
      allowPlannedDependencies:
        options.dryRun &&
        shouldRun(options, "memberships") &&
        shouldRun(options, "events"),
      dryRun: options.dryRun,
    });
    summary.push(format("Auth users", userSummary.authUsers));
    summary.push(format("User profiles", userSummary.profiles));
    summary.push(format("Purchases", userSummary.purchases));
    summary.push(format("Event registrations", userSummary.registrations));
    summary.push(format("Application responses", userSummary.responses));
    summary.push(format("Check-ins", userSummary.checkIns));
  }

  console.log(summary.join("\n"));
  console.log(options.dryRun ? "\nDry run complete." : "\nSeed complete.");
}

main().catch((error: unknown) => {
  console.error(`\nSeed failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
