/**
 * Reconciles a Supabase database to the seed data. See ./README.md.
 *
 *   pnpm seed                      # local: make the database match the seed data
 *   pnpm seed --no-prune           # local: sync, but keep rows the data dropped
 *   pnpm seed --target=prod        # prod: add and update demo data, never delete
 *   pnpm seed --dry-run            # print the plan, write nothing
 *   pnpm seed --only=events        # storage | memberships | events | users
 *
 * Safe to run repeatedly against either target: rows are matched on their
 * natural key (slug for events and membership tiers, name/question for
 * children, idempotency key for purchases), so a re-run syncs edits instead of
 * duplicating or erroring.
 *
 * Deleting is the default half of "reconcile", but only on `--target=local`.
 * Rows the seed owns but no longer describes are removed there, which is what
 * makes an event ticket bought through the UI reversible — the next run drops
 * the purchase and the event is buyable again. Ownership is narrow and is
 * defined in `lib/prune.ts`: seed events and membership tiers by slug, and
 * purchases/registrations only when they belong to one of the three fixture
 * accounts. Rows created by an account somebody made by hand are never touched.
 *
 * `--target=prod` exists to give admins demo events to work with while the
 * student-facing events feature is unlaunched. It never deletes, never writes
 * user fixtures, and forces every event to `draft` so nothing fabricated is
 * reachable through the public API. See `lib/targets.ts`.
 *
 * Table names mirror TABLES in src/lib/supabase-helpers/tables.ts, and BUCKET
 * mirrors BUCKETS in src/lib/supabase-helpers/buckets.ts. Those modules cannot
 * be imported here — the helper tree imports through the `@/*` alias, which Node
 * does not resolve — so keep them in sync by hand.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  addCounts,
  emptyCounts,
  reconcileChildren,
  upsertBySlug,
  type Counts,
  type ReconcileOptions,
} from "./lib/reconcile.ts";
import { describeSkippedPrune, planPrune } from "./lib/prune.ts";
import {
  pruneSeedImages,
  seedImageUrl,
  uploadSeedImages,
  listSeedImageFiles,
} from "./lib/images.ts";
import { membershipTypes } from "./data/membership-types.ts";
import { buildSeedEvents, type SeedEvent } from "./data/events.ts";
import {
  buildSeedUsers,
  RETIRED_FIXTURE_EMAILS,
  type SeedUser,
} from "./data/users.ts";
import {
  pruneUserFixtures,
  reconcileUserFixtures,
  removeRetiredFixtures,
} from "./lib/reconcile-users.ts";
import { validateUserFixtures } from "./lib/user-fixtures.ts";
import {
  parseTarget,
  resolveTarget,
  type SeedTarget,
} from "./lib/targets.ts";

/**
 * Mirrors BUCKETS in src/lib/supabase-helpers/buckets.ts, and the migration at
 * supabase/migrations/20260821120000_create_event_images_bucket.sql. Remote
 * environments get this bucket from that migration, so `--target=prod` expects
 * it to exist already and says so if it does not. Locally the seed provisions
 * it, which keeps a fresh database usable without a migration run.
 */
const BUCKET = {
  eventImages: {
    id: "event-images",
    public: true,
    fileSizeLimit: 4194304,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  },
} as const;

const TABLE = {
  membershipTypes: "membership_types",
  events: "events",
  purchases: "purchases",
  checkInSessions: "check_in_sessions",
  eventApplicationQuestions: "event_application_questions",
  mentors: "mentors",
  sponsors: "sponsors",
  eventMentors: "event_mentors",
  eventSponsors: "event_sponsors",
} as const;

interface Options extends ReconcileOptions {
  only: Set<string>;
  target: SeedTarget;
}

const TARGETS = ["storage", "memberships", "events", "users"] as const;

function parseArgs(argv: string[]): Options {
  const only = new Set<string>();
  let dryRun = false;
  let prune = true;
  let target: SeedTarget = "local";

  for (const arg of argv) {
    // pnpm 10 forwards the `--` separator through to the script rather than
    // consuming it, so `pnpm seed -- --dry-run` arrives with a bare `--`.
    if (arg === "--") continue;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--no-prune") prune = false;
    else if (arg.startsWith("--target=")) {
      target = parseTarget(arg.slice("--target=".length).trim());
    } else if (arg.startsWith("--only=")) {
      for (const part of arg.slice("--only=".length).split(",")) {
        const trimmed = part.trim();
        if (trimmed) only.add(trimmed);
      }
    } else {
      throw new Error(
        `Unknown argument "${arg}". Supported: --target=, --only=, --dry-run, --no-prune`
      );
    }
  }

  const known = new Set<string>(TARGETS);
  for (const name of only) {
    if (!known.has(name)) {
      throw new Error(
        `Unknown --only target "${name}". Supported: ${[...known].join(", ")}`
      );
    }
  }

  return { only, dryRun, prune, target };
}

function shouldRun(options: Options, target: string): boolean {
  return options.only.size === 0 || options.only.has(target);
}

/**
 * Creates the storage buckets the app expects, or updates their settings when
 * they already exist. Idempotent, like the rest of the seed.
 */
async function reconcileBuckets(
  supabase: SupabaseClient,
  options: Options
): Promise<string> {
  const spec = BUCKET.eventImages;
  const { data: existing } = await supabase.storage.getBucket(spec.id);

  // Prod gets its bucket from the migration, not from here. Creating it as a
  // side effect of seeding would paper over a deploy that never ran.
  if (options.target === "prod") {
    if (!existing) {
      throw new Error(
        `The "${spec.id}" bucket is missing from the deployed project.\n` +
          "  Apply the migrations first: npx supabase db push"
      );
    }
    return "Storage buckets: verified";
  }

  if (options.dryRun) {
    return `Storage buckets: ${existing ? "0 created, 1 updated" : "1 created, 0 updated"}`;
  }

  const settings = {
    public: spec.public,
    fileSizeLimit: spec.fileSizeLimit,
    allowedMimeTypes: [...spec.allowedMimeTypes],
  };

  if (existing) {
    const { error } = await supabase.storage.updateBucket(spec.id, settings);
    if (error) throw error;
    return "Storage buckets: 0 created, 1 updated";
  }

  const { error } = await supabase.storage.createBucket(spec.id, settings);
  if (error) throw error;
  return "Storage buckets: 1 created, 0 updated";
}

/**
 * Fails loudly when a fixture names a cover image that is not on disk. Without
 * this the seed would happily write an `image_url` pointing at nothing.
 */
async function assertImageKeysExist(seedEvents: SeedEvent[]): Promise<void> {
  const available = new Set(await listSeedImageFiles());
  const missing = [
    ...new Set(
      seedEvents
        .filter((seed) => !available.has(seed.imageKey))
        .map((seed) => `${seed.event.slug} -> ${seed.imageKey}`)
    ),
  ];

  if (missing.length > 0) {
    throw new Error(
      `Missing cover images in scripts/seed/data/images: ${missing.join(", ")}`
    );
  }
}

function format(label: string, counts: Counts): string {
  const parts = [`${counts.created} created`, `${counts.updated} updated`];
  if (counts.pruned > 0) parts.push(`${counts.pruned} pruned`);
  return `${label}: ${parts.join(", ")}`;
}

function formatPruned(label: string, pruned: number): string | null {
  return pruned > 0 ? `${label}: ${pruned} pruned` : null;
}

/**
 * Deletes seed-owned rows the data no longer describes.
 *
 * Runs after every reconcile rather than inside each one, because the order is
 * cross-cutting: `purchases.event_id` is `on delete restrict`, so a stale event
 * can only be dropped once the fixture purchases pointing at it are gone.
 */
async function prunePass(
  supabase: SupabaseClient,
  seedEvents: SeedEvent[],
  seedUsers: SeedUser[],
  profileIds: Map<string, string>,
  options: Options
): Promise<string[]> {
  const lines: string[] = [];

  /* ── Fixture-owned rows: purchases, registrations, and their children ── */
  if (shouldRun(options, "users") && profileIds.size > 0) {
    const pruned = await pruneUserFixtures(supabase, seedUsers, profileIds, {
      dryRun: options.dryRun,
    });

    for (const [label, count] of [
      ["Purchases", pruned.purchases],
      ["Event registrations", pruned.registrations],
      ["Application responses", pruned.responses],
      ["Check-ins", pruned.checkIns],
    ] as const) {
      const line = formatPruned(label, count);
      if (line) lines.push(line);
    }
  }

  /* ── Events ── */
  if (shouldRun(options, "events")) {
    const { data, error } = await supabase.from(TABLE.events).select("id, slug");
    if (error) throw new Error(`Reading events failed: ${error.message}`);

    const plan = planPrune(
      (data ?? []) as { id: string; slug: string | null }[],
      (row) => row.slug,
      seedEvents.map((seed) => seed.event.slug)
    );

    // `purchases.event_id` is `on delete restrict`, so an event somebody bought
    // a ticket for survives the prune. That is the guardrail working: by this
    // point the fixture accounts' purchases are already gone, so anything still
    // pointing here belongs to an account created by hand.
    //
    // A real run discovers this from the failed delete. A dry run has to ask,
    // otherwise it would promise deletions that will not happen — so it looks
    // for purchases held by anyone outside the fixture set.
    const blockedIds = new Set<string>();

    if (options.dryRun && plan.remove.length > 0) {
      let query = supabase
        .from(TABLE.purchases)
        .select("event_id")
        .in(
          "event_id",
          plan.remove.map((entry) => entry.row.id)
        );

      const fixtureIds = [...profileIds.values()];
      if (fixtureIds.length > 0) {
        query = query.not("user_id", "in", `(${fixtureIds.join(",")})`);
      }

      const { data: blockingPurchases, error: purchaseError } = await query;
      if (purchaseError) {
        throw new Error(`Reading purchases failed: ${purchaseError.message}`);
      }

      for (const row of (blockingPurchases ?? []) as { event_id: string | null }[]) {
        if (row.event_id) blockedIds.add(row.event_id);
      }
    }

    let pruned = 0;
    const blocked: string[] = [];

    for (const entry of plan.remove) {
      if (options.dryRun) {
        if (blockedIds.has(entry.row.id)) blocked.push(entry.key);
        else pruned += 1;
        continue;
      }

      const { error: deleteError } = await supabase
        .from(TABLE.events)
        .delete()
        .eq("id", entry.row.id);

      if (deleteError) {
        blocked.push(entry.key);
        continue;
      }
      pruned += 1;
    }

    const line = formatPruned("Events", pruned);
    if (line) lines.push(line);
    if (blocked.length > 0) {
      lines.push(
        `  ! Events kept because a non-fixture purchase references them: ${blocked.join(", ")}`
      );
    }
  }

  /* ── Mentors and sponsors ── */
  if (shouldRun(options, "events")) {
    const desiredMentors = seedEvents.flatMap((seed) =>
      (seed.mentors ?? []).map((mentor) => mentor.name)
    );
    const desiredSponsors = seedEvents.flatMap((seed) => seed.sponsors ?? []);

    for (const [table, column, desired, label] of [
      [TABLE.mentors, "full_name", desiredMentors, "Mentors"],
      [TABLE.sponsors, "brand_logo_path", desiredSponsors, "Sponsors"],
    ] as const) {
      const { data, error } = await supabase.from(table).select(`id, ${column}`);
      if (error) throw new Error(`Reading ${table} failed: ${error.message}`);

      const rows = (data ?? []) as unknown as Record<string, string | null>[];
      const plan = planPrune(rows, (row) => row[column], desired);

      let pruned = 0;
      const blocked: string[] = [];

      for (const entry of plan.remove) {
        if (options.dryRun) {
          pruned += 1;
          continue;
        }

        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq("id", entry.row.id);

        // Link tables are `on delete restrict`, so anyone still attached to an
        // event stays put.
        if (deleteError) blocked.push(entry.key);
        else pruned += 1;
      }

      const line = formatPruned(label, pruned);
      if (line) lines.push(line);
      if (blocked.length > 0) {
        lines.push(describeSkippedPrune(table, blocked));
      }
    }
  }

  /* ── Membership tiers ── */
  if (shouldRun(options, "memberships")) {
    const { data, error } = await supabase
      .from(TABLE.membershipTypes)
      .select("id, slug");
    if (error) throw new Error(`Reading membership tiers failed: ${error.message}`);

    const plan = planPrune(
      (data ?? []) as { id: string; slug: string | null }[],
      (row) => row.slug,
      membershipTypes.map((tier) => tier.slug)
    );

    let pruned = 0;
    const blocked: string[] = [];

    for (const entry of plan.remove) {
      if (options.dryRun) {
        pruned += 1;
        continue;
      }

      const { error: deleteError } = await supabase
        .from(TABLE.membershipTypes)
        .delete()
        .eq("id", entry.row.id);

      // Held by a member, or referenced by a purchase: both are `restrict`.
      if (deleteError) blocked.push(entry.key);
      else pruned += 1;
    }

    const line = formatPruned("Membership tiers", pruned);
    if (line) lines.push(line);
    if (blocked.length > 0) {
      lines.push(describeSkippedPrune(TABLE.membershipTypes, blocked));
    }
  }

  /* ── Cover images ── */
  if (shouldRun(options, "storage")) {
    const { pruned } = await pruneSeedImages(
      supabase,
      BUCKET.eventImages.id,
      seedEvents.map((seed) => seed.imageKey),
      { dryRun: options.dryRun }
    );

    const line = formatPruned("Cover images", pruned);
    if (line) lines.push(line);
  }

  return lines;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const seedNow = new Date();
  const seedEvents = buildSeedEvents(seedNow);
  const seedUsers = buildSeedUsers(seedEvents, seedNow);
  validateUserFixtures(seedUsers, seedEvents, membershipTypes, seedNow);
  await assertImageKeysExist(seedEvents);

  const { url, secretKey, policy } = resolveTarget(options.target, process.env);
  const host = new URL(url).hostname;

  // The target's policy is not negotiable from the command line: prod never
  // deletes and never writes login fixtures, whatever the flags say.
  if (!policy.prune) options.prune = false;

  if (!policy.users && options.only.has("users")) {
    throw new Error(
      `--only=users is not available with --target=${options.target}.\n` +
        `  The fixture accounts share a known password (see data/users.ts) and\n` +
        "  belong on a local database only."
    );
  }

  const skipUsers = !policy.users;
  const notices: string[] = [];

  if (options.target === "prod") {
    notices.push(`Target: prod (${host}) — adds and updates only, never deletes.`);
    if (policy.forceDraft) {
      notices.push("Every seeded event is forced to draft.");
    }
    if (skipUsers) {
      notices.push("User fixtures, purchases, and registrations are skipped.");
    }
  }

  if (options.dryRun) {
    notices.push("Dry run — no writes will be made.");
  }

  if (notices.length > 0) {
    console.log(notices.map((notice) => `! ${notice}`).join("\n") + "\n");
  }

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: string[] = [];

  if (shouldRun(options, "storage")) {
    summary.push(await reconcileBuckets(supabase, options));
    summary.push(
      format(
        "Cover images",
        await uploadSeedImages(
          supabase,
          BUCKET.eventImages.id,
          seedEvents.map((seed) => seed.imageKey),
          options
        )
      )
    );
  }

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
      seedEvents.map((seed) => ({
        ...seed.event,
        // See TargetPolicy.forceDraft: an active row stays readable through the
        // anon API even while the studentEvents flag hides every page for it.
        status: policy.forceDraft ? ("draft" as const) : seed.event.status,
        event_type: seed.event.event_type ?? "regular",
        short_description:
          seed.event.short_description ??
          seed.event.description.slice(0, 180),
        // Built from the target's own host rather than uploaded here, so
        // `--only=events` still resolves images a previous run wrote.
        image_url: seedImageUrl(supabase, BUCKET.eventImages.id, seed.imageKey),
        mentors_enabled: Boolean(seed.mentors?.length),
        sponsors_enabled: Boolean(seed.sponsors?.length),
        applications_enabled: seed.applicationQuestions.length > 0,
      })),
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
          seed.applicationQuestions.map((question, sortOrder) => ({
            ...question,
            description: null,
            sort_order: sortOrder,
          })),
          options
        )
      );

      if (!options.dryRun) {
        const mentorIds: string[] = [];
        for (const mentor of seed.mentors ?? []) {
          const { data: existingMentor, error: mentorReadError } = await supabase
            .from(TABLE.mentors)
            .select("id")
            .eq("full_name", mentor.name)
            .maybeSingle();
          if (mentorReadError) throw mentorReadError;

          const mentorPayload = {
            full_name: mentor.name,
            position: [mentor.role, mentor.company].filter(Boolean).join(" at "),
            linkedin_url: mentor.linkedin_url ?? null,
            description: mentor.bio ?? null,
            profile_image_path: mentor.image_url ?? null,
          };
          if (existingMentor) {
            const { error } = await supabase
              .from(TABLE.mentors)
              .update(mentorPayload)
              .eq("id", existingMentor.id);
            if (error) throw error;
            mentorIds.push(existingMentor.id);
          } else {
            const { data, error } = await supabase
              .from(TABLE.mentors)
              .insert(mentorPayload)
              .select("id")
              .single();
            if (error) throw error;
            mentorIds.push(data.id);
          }
        }

        const { error: clearMentorsError } = await supabase
          .from(TABLE.eventMentors)
          .delete()
          .eq("event_id", eventId);
        if (clearMentorsError) throw clearMentorsError;
        if (mentorIds.length) {
          const { error } = await supabase.from(TABLE.eventMentors).insert(
            mentorIds.map((mentorId, sortOrder) => ({
              event_id: eventId,
              mentor_id: mentorId,
              sort_order: sortOrder,
            }))
          );
          if (error) throw error;
        }

        const sponsorIds: string[] = [];
        for (const [index, logo] of (seed.sponsors ?? []).entries()) {
          const { data: existingSponsor, error: sponsorReadError } =
            await supabase
              .from(TABLE.sponsors)
              .select("id")
              .eq("brand_logo_path", logo)
              .maybeSingle();
          if (sponsorReadError) throw sponsorReadError;

          if (existingSponsor) {
            sponsorIds.push(existingSponsor.id);
          } else {
            const { data, error } = await supabase
              .from(TABLE.sponsors)
              .insert({
                name: `Seed Sponsor ${index + 1}`,
                brand_logo_path: logo,
              })
              .select("id")
              .single();
            if (error) throw error;
            sponsorIds.push(data.id);
          }
        }

        const { error: clearSponsorsError } = await supabase
          .from(TABLE.eventSponsors)
          .delete()
          .eq("event_id", eventId);
        if (clearSponsorsError) throw clearSponsorsError;
        if (sponsorIds.length) {
          const { error } = await supabase.from(TABLE.eventSponsors).insert(
            sponsorIds.map((sponsorId, sortOrder) => ({
              event_id: eventId,
              sponsor_id: sponsorId,
              sort_order: sortOrder,
            }))
          );
          if (error) throw error;
        }
      }
    }

    summary.push(format("Check-in sessions", sessionCounts));
    summary.push(format("Application questions", questionCounts));
  }

  let profileIds = new Map<string, string>();

  if (!skipUsers && shouldRun(options, "users")) {
    // Before anything is written: a renamed fixture's old account still holds
    // the idempotency keys the new one needs.
    if (options.prune) {
      const retired = await removeRetiredFixtures(
        supabase,
        RETIRED_FIXTURE_EMAILS,
        options
      );
      if (retired > 0) {
        summary.push(`Retired fixture accounts: ${retired} deleted`);
      }
    }

    const userSummary = await reconcileUserFixtures(supabase, seedUsers, {
      allowPlannedDependencies:
        options.dryRun &&
        shouldRun(options, "memberships") &&
        shouldRun(options, "events"),
      dryRun: options.dryRun,
    });
    profileIds = userSummary.profileIds;
    summary.push(format("Auth users", userSummary.authUsers));
    summary.push(format("User profiles", userSummary.profiles));
    summary.push(format("Purchases", userSummary.purchases));
    summary.push(format("Event registrations", userSummary.registrations));
    summary.push(format("Application responses", userSummary.responses));
    summary.push(format("Check-ins", userSummary.checkIns));
  }

  if (options.prune) {
    const pruned = await prunePass(
      supabase,
      seedEvents,
      seedUsers,
      profileIds,
      options
    );
    if (pruned.length > 0) {
      summary.push("", "Pruned:", ...pruned);
    }
  }

  console.log(summary.join("\n"));
  console.log(
    options.dryRun
      ? `\nDry run complete (${options.target}).`
      : `\nSeed complete (${options.target}).`
  );
}

main().catch((error: unknown) => {
  console.error(`\nSeed failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
