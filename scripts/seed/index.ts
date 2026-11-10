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
 * purchases, tickets and applications only when they belong to one of the fixture
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
import { seedTeams } from "./data/teams.ts";
import { dateString } from "./lib/relative-dates.ts";
import {
  buildSeedUsers,
  RETIRED_FIXTURE_EMAILS,
  type SeedUser,
} from "./data/users.ts";
import { buildSeedCrowd } from "./data/crowd.ts";
import {
  pruneCrowdProfiles,
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
 * Mirrors BUCKETS in src/lib/supabase-helpers/buckets.ts, and the migrations
 * that create each bucket (20260821120000_create_event_images_bucket.sql,
 * 20261014090000_add_user_profile_photos.sql and
 * 20261106193115_application_files_bucket.sql). Remote environments get them
 * from those migrations, so `--target=prod` expects them to exist already and
 * says so if one does not. Locally the seed provisions them, which keeps a
 * fresh database usable without a migration run. The application-files
 * policies live only in its migration.
 */
const BUCKET = {
  profilePhotos: {
    id: "profile-photos", public: true, fileSizeLimit: 4194304,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  },
  eventImages: {
    id: "event-images",
    public: true,
    fileSizeLimit: 4194304,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  },
  applicationFiles: {
    id: "application-files",
    public: false,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["application/pdf"],
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
  eventPeopleSections: "event_people_sections",
  eventSponsors: "event_sponsors",
  eventLinks: "event_links",
  eventPrivateDetails: "event_private_details",
  eventAgendaDays: "event_agenda_days",
  eventAgendaItems: "event_agenda_items",
  teams: "teams",
  teamMembers: "team_members",
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
  const results: string[] = [];
  for (const spec of Object.values(BUCKET)) {
    const { data: existing } = await supabase.storage.getBucket(spec.id);

    // Prod gets its bucket from the migration, not from here. Creating it as a
    // side effect of seeding would paper over a deploy that never ran.
    if (options.target === "prod") {
      if (!existing) {
        throw new Error(
          `The "${spec.id}" bucket is missing from the deployed project.\n` +
            "  Apply the migrations first: pnpm exec supabase db push"
        );
      }
      results.push("Storage buckets: verified");
      continue;
    }

    if (options.dryRun) {
      results.push(`Storage buckets: ${existing ? "0 created, 1 updated" : "1 created, 0 updated"}`);
      continue;
    }

    const settings = {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: [...spec.allowedMimeTypes],
    };

    if (existing) {
      const { error } = await supabase.storage.updateBucket(spec.id, settings);
      if (error) throw error;
      results.push("Storage buckets: 0 created, 1 updated");
      continue;
    }

    const { error } = await supabase.storage.createBucket(spec.id, settings);
    if (error) throw error;
    results.push("Storage buckets: 1 created, 0 updated");
  }
  return results.join("; ");
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

  /* ── Fixture-owned rows: purchases, tickets, applications, and their children ── */
  if (shouldRun(options, "users") && profileIds.size > 0) {
    const pruned = await pruneUserFixtures(supabase, seedUsers, profileIds, {
      dryRun: options.dryRun,
    });

    for (const [label, count] of [
      ["Purchases", pruned.purchases],
      ["Event tickets", pruned.tickets],
      ["Event applications", pruned.applications],
      ["Application responses", pruned.responses],
      ["Application files", pruned.files],
      ["Check-ins", pruned.checkIns],
    ] as const) {
      const line = formatPruned(label, count);
      if (line) lines.push(line);
    }
  }

  /* ── Crowd accounts the data no longer lists ── */
  if (shouldRun(options, "users")) {
    const crowdEmails = seedUsers
      .filter((user) => user.password === null)
      .map((user) => user.email);
    const line = formatPruned(
      "Crowd accounts",
      await pruneCrowdProfiles(supabase, crowdEmails, { dryRun: options.dryRun })
    );
    if (line) lines.push(line);
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
      (seed.peopleSections ?? []).flatMap((section) =>
        section.people.map((person) => person.name)
      )
    );
    const desiredSponsors = seedEvents.flatMap((seed) =>
      (seed.sponsors ?? []).map((sponsor) => sponsor.logo)
    );

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

type SeedPerson = NonNullable<SeedEvent["peopleSections"]>[number]["people"][number];

/** The mentors row for a seeded person, matched by name, kept up to date. */
async function upsertMentor(
  supabase: SupabaseClient,
  person: SeedPerson
): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from(TABLE.mentors)
    .select("id")
    .eq("full_name", person.name)
    .maybeSingle();
  if (readError) throw readError;

  const payload = {
    full_name: person.name,
    position: [person.role, person.company].filter(Boolean).join(" at "),
    linkedin_url: person.linkedin_url ?? null,
    description: person.bio ?? null,
    profile_image_path: person.image_url ?? null,
  };
  if (existing) {
    const { error } = await supabase
      .from(TABLE.mentors)
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data, error } = await supabase
    .from(TABLE.mentors)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * The event's people sections, in page order, and the people in each. The
 * links are rewritten whole each run, as the sponsors are.
 */
async function reconcilePeopleSections(
  supabase: SupabaseClient,
  eventId: string,
  seed: SeedEvent,
  options: Options
): Promise<Counts> {
  const sections = seed.peopleSections ?? [];
  const counts = await reconcileChildren(
    supabase,
    TABLE.eventPeopleSections,
    "event_id",
    eventId,
    "title",
    sections.map((section, sortOrder) => ({
      title: section.title,
      sort_order: sortOrder,
    })),
    options
  );
  if (options.dryRun) return counts;

  const { data: rows, error: readError } = await supabase
    .from(TABLE.eventPeopleSections)
    .select("id, title")
    .eq("event_id", eventId);
  if (readError) throw readError;
  const sectionIds = new Map(
    (rows ?? []).map((row) => [row.title as string, row.id as string])
  );

  const { error: clearError } = await supabase
    .from(TABLE.eventMentors)
    .delete()
    .eq("event_id", eventId);
  if (clearError) throw clearError;

  for (const section of sections) {
    const sectionId = sectionIds.get(section.title);
    if (!sectionId) throw new Error(`No id for section "${section.title}"`);
    const links = [];
    for (const [sortOrder, person] of section.people.entries()) {
      links.push({
        event_id: eventId,
        section_id: sectionId,
        mentor_id: await upsertMentor(supabase, person),
        sort_order: sortOrder,
      });
    }
    if (links.length > 0) {
      const { error } = await supabase.from(TABLE.eventMentors).insert(links);
      if (error) throw error;
    }
  }
  return counts;
}

/** The event's sponsors, matched by logo, with their details kept up to date. */
async function reconcileSponsors(
  supabase: SupabaseClient,
  eventId: string,
  seed: SeedEvent
): Promise<void> {
  const sponsorIds: string[] = [];
  for (const sponsor of seed.sponsors ?? []) {
    const { data: existing, error: readError } = await supabase
      .from(TABLE.sponsors)
      .select("id")
      .eq("brand_logo_path", sponsor.logo)
      .maybeSingle();
    if (readError) throw readError;

    const payload = {
      name: sponsor.name,
      brand_logo_path: sponsor.logo,
      description: sponsor.description,
      website_url: sponsor.website_url,
    };
    if (existing) {
      const { error } = await supabase
        .from(TABLE.sponsors)
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      sponsorIds.push(existing.id as string);
    } else {
      const { data, error } = await supabase
        .from(TABLE.sponsors)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      sponsorIds.push(data.id as string);
    }
  }

  const { error: clearError } = await supabase
    .from(TABLE.eventSponsors)
    .delete()
    .eq("event_id", eventId);
  if (clearError) throw clearError;
  if (sponsorIds.length > 0) {
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

/** The event's links, keyed by URL, in order. */
function reconcileEventLinks(
  supabase: SupabaseClient,
  eventId: string,
  seed: SeedEvent,
  options: Options
): Promise<Counts> {
  return reconcileChildren(
    supabase,
    TABLE.eventLinks,
    "event_id",
    eventId,
    "url",
    (seed.links ?? []).map((link, sortOrder) => ({
      ...link,
      label: link.label ?? null,
      visibility: link.visibility ?? "everyone",
      sort_order: sortOrder,
    })),
    options
  );
}

/** The event's online meeting details: one row, or none. */
async function reconcilePrivateDetails(
  supabase: SupabaseClient,
  eventId: string,
  seed: SeedEvent,
  options: Options
): Promise<Counts> {
  const counts = emptyCounts();
  if (seed.privateDetails) {
    counts.updated += 1;
    if (options.dryRun) return counts;
    const { error } = await supabase.from(TABLE.eventPrivateDetails).upsert({
      event_id: eventId,
      meeting_id: null,
      meeting_passcode: null,
      ...seed.privateDetails,
    });
    if (error) throw error;
    return counts;
  }

  if (!options.prune || options.dryRun) return counts;
  const { count, error } = await supabase
    .from(TABLE.eventPrivateDetails)
    .delete({ count: "exact" })
    .eq("event_id", eventId);
  if (error) throw error;
  counts.pruned += count ?? 0;
  return counts;
}

/** The event's agenda days, keyed by date, and each day's items, keyed by title. */
async function reconcileAgenda(
  supabase: SupabaseClient,
  eventId: string,
  seed: SeedEvent,
  options: Options
): Promise<Counts> {
  const days = seed.agendaDays ?? [];
  const counts = await reconcileChildren(
    supabase,
    TABLE.eventAgendaDays,
    "event_id",
    eventId,
    "date",
    days.map((day) => ({ date: dateString(day.date), title: day.title ?? null })),
    options
  );
  if (options.dryRun || days.length === 0) return counts;

  const { data: rows, error } = await supabase
    .from(TABLE.eventAgendaDays)
    .select("id, date")
    .eq("event_id", eventId);
  if (error) throw error;
  const dayIds = new Map(
    (rows ?? []).map((row) => [row.date as string, row.id as string])
  );

  for (const day of days) {
    const dayId = dayIds.get(dateString(day.date));
    if (!dayId) throw new Error(`No id for agenda day ${dateString(day.date)}`);
    await reconcileChildren(
      supabase,
      TABLE.eventAgendaItems,
      "event_agenda_day_id",
      dayId,
      "title",
      day.items.map((item) => ({
        title: item.title,
        start_time: item.start,
        end_time: item.end,
        building: item.building ?? null,
        room: item.room ?? null,
      })),
      options
    );
  }
  return counts;
}

/**
 * The fixture teams in `data/teams.ts`, made and joined through create_team
 * and join_team so they obey the same rules as a student's. A run also undoes
 * team changes fixtures made through the app, as it undoes their purchases.
 */
async function reconcileTeams(
  supabase: SupabaseClient,
  profileIds: Map<string, string>,
  options: Options
): Promise<Counts> {
  const counts = emptyCounts();
  if (options.dryRun) {
    counts.created += seedTeams.length;
    return counts;
  }

  const fixtureIds = [...profileIds.values()];
  const idOf = (email: string) => {
    const id = profileIds.get(email);
    if (!id) throw new Error(`No profile for team fixture ${email}`);
    return id;
  };

  const { data: events, error: eventsError } = await supabase
    .from(TABLE.events)
    .select("id, slug")
    .in("slug", seedTeams.map((team) => team.eventSlug));
  if (eventsError) throw eventsError;
  const eventIds = new Map(
    (events ?? []).map((event) => [event.slug as string, event.id as string])
  );

  // Who should be on which team: event id and user id, to the owner's id.
  const desired = new Map<string, string>();
  for (const team of seedTeams) {
    const eventId = eventIds.get(team.eventSlug);
    if (!eventId) throw new Error(`No event "${team.eventSlug}" for a team fixture`);
    const ownerId = idOf(team.ownerEmail);
    for (const email of [team.ownerEmail, ...team.memberEmails]) {
      desired.set(`${eventId}:${idOf(email)}`, ownerId);
    }
  }

  if (options.prune && fixtureIds.length > 0) {
    // Teams fixtures own that the data doesn't describe go, with their members.
    const { data: owned, error } = await supabase
      .from(TABLE.teams)
      .select("id, event_id, owner_id")
      .in("owner_id", fixtureIds);
    if (error) throw error;
    for (const team of owned ?? []) {
      if (desired.get(`${team.event_id}:${team.owner_id}`) === team.owner_id) continue;
      const { error: deleteError } = await supabase
        .from(TABLE.teams)
        .delete()
        .eq("id", team.id);
      if (deleteError) throw deleteError;
      counts.pruned += 1;
    }
  }

  for (const team of seedTeams) {
    const eventId = eventIds.get(team.eventSlug)!;
    const ownerId = idOf(team.ownerEmail);
    const memberIds = team.memberEmails.map(idOf);

    const { data: existing, error: readError } = await supabase
      .from(TABLE.teams)
      .select("id, invite_code")
      .eq("event_id", eventId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (readError) throw readError;

    let teamId = existing?.id as string | undefined;
    let inviteCode = existing?.invite_code as string | undefined;
    if (teamId) {
      counts.updated += 1;
      const { error } = await supabase
        .from(TABLE.teams)
        .update({ name: team.name })
        .eq("id", teamId);
      if (error) throw error;
    } else {
      // The owner may be on someone else's team from an earlier run.
      await supabase
        .from(TABLE.teamMembers)
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", ownerId);
      const { data, error } = await supabase.rpc("create_team", {
        p_event_id: eventId,
        p_user_id: ownerId,
        p_name: team.name ?? undefined,
      });
      if (error) throw error;
      const row = data?.[0];
      if (row?.failure_reason) {
        throw new Error(`Creating team "${team.name}" failed: ${row.failure_reason}`);
      }
      teamId = row.team_id as string;
      const { data: created, error: codeError } = await supabase
        .from(TABLE.teams)
        .select("invite_code")
        .eq("id", teamId)
        .single();
      if (codeError) throw codeError;
      inviteCode = created.invite_code as string;
      counts.created += 1;
    }

    // Fixture members not listed here leave; listed ones join if they aren't on it.
    const { data: members, error: membersError } = await supabase
      .from(TABLE.teamMembers)
      .select("user_id, team_id")
      .eq("event_id", eventId)
      .in("user_id", fixtureIds);
    if (membersError) throw membersError;
    for (const member of members ?? []) {
      const wantedOwner = desired.get(`${eventId}:${member.user_id}`);
      // Already where they belong.
      if (wantedOwner === ownerId && member.team_id === teamId) continue;
      // Belongs on another seeded team: that team's pass sorts it out.
      if (wantedOwner !== undefined && wantedOwner !== ownerId) continue;
      // On no seeded team: a team joined through the app, kept by --no-prune.
      if (wantedOwner === undefined && !options.prune) continue;
      const { error } = await supabase
        .from(TABLE.teamMembers)
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", member.user_id);
      if (error) throw error;
    }
    for (const memberId of memberIds) {
      const { data: current } = await supabase
        .from(TABLE.teamMembers)
        .select("team_id")
        .eq("event_id", eventId)
        .eq("user_id", memberId)
        .maybeSingle();
      if (current?.team_id === teamId) continue;
      const { data, error } = await supabase.rpc("join_team", {
        p_invite_code: inviteCode,
        p_user_id: memberId,
      });
      if (error) throw error;
      if (data?.[0]?.failure_reason) {
        throw new Error(`Joining team "${team.name}" failed: ${data[0].failure_reason}`);
      }
    }
  }
  return counts;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const seedNow = new Date();
  const seedEvents = buildSeedEvents(seedNow);
  // Login fixtures, then the crowd: profile-only accounts for volume.
  const seedUsers = [
    ...buildSeedUsers(seedEvents, seedNow),
    ...buildSeedCrowd(seedEvents, seedNow),
  ];
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
      notices.push("User fixtures, purchases, tickets, and applications are skipped.");
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
        // A schedule would have the database publish the event itself, which
        // on prod would undo forceDraft a few days later.
        publish_at: policy.forceDraft ? null : (seed.event.publish_at ?? null),
        event_type: seed.event.event_type ?? "regular",
        // One upsert writes every event, and PostgREST fills a column only some
        // rows name with null, not its default: spell the defaults out.
        is_featured: seed.event.is_featured ?? false,
        location_type: seed.event.location_type ?? "in_person",
        agenda_enabled: seed.event.agenda_enabled ?? true,
        teams_enabled: seed.event.teams_enabled ?? false,
        short_description:
          seed.event.short_description ??
          seed.event.description.slice(0, 180),
        // Built from the target's own host rather than uploaded here, so
        // `--only=events` still resolves images a previous run wrote.
        image_url: seedImageUrl(supabase, BUCKET.eventImages.id, seed.imageKey),
        mentors_enabled: Boolean(
          seed.peopleSections?.some((section) => section.people.length > 0)
        ),
        sponsors_enabled: Boolean(seed.sponsors?.length),
        requires_application: seed.applicationQuestions.length > 0,
      })),
      options
    );
    summary.push(format("Events", eventCounts));

    const sessionCounts = emptyCounts();
    const questionCounts = emptyCounts();
    const sectionCounts = emptyCounts();
    const linkCounts = emptyCounts();
    const privateDetailCounts = emptyCounts();
    const agendaCounts = emptyCounts();

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

      addCounts(
        sectionCounts,
        await reconcilePeopleSections(supabase, eventId, seed, options)
      );
      if (!options.dryRun) {
        await reconcileSponsors(supabase, eventId, seed);
      }
      addCounts(linkCounts, await reconcileEventLinks(supabase, eventId, seed, options));
      addCounts(
        privateDetailCounts,
        await reconcilePrivateDetails(supabase, eventId, seed, options)
      );
      addCounts(agendaCounts, await reconcileAgenda(supabase, eventId, seed, options));
    }

    summary.push(format("Check-in sessions", sessionCounts));
    summary.push(format("Application questions", questionCounts));
    summary.push(format("People sections", sectionCounts));
    summary.push(format("Event links", linkCounts));
    summary.push(format("Meeting details", privateDetailCounts));
    summary.push(format("Agenda days", agendaCounts));
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
    summary.push(format("Event tickets", userSummary.tickets));
    summary.push(format("Event applications", userSummary.applications));
    summary.push(format("Application responses", userSummary.responses));
    summary.push(format("Application files", userSummary.files));
    summary.push(format("Check-ins", userSummary.checkIns));
    summary.push(format("Teams", await reconcileTeams(supabase, profileIds, options)));
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
