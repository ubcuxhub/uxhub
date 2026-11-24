/**
 * Which existing events the seed may write to or delete.
 *
 * A slug alone does not prove the seed owns a row. Seed slugs are ordinary
 * event names (`portfolio-review-night`, `student-panel`), an admin can turn a
 * seeded demo event into a real one, and anybody can register for an event the
 * seed made. Two rules follow, one per target:
 *
 * - `--target=prod` writes only to events that still look exactly as the seed
 *   left them: a draft that was never published, scheduled or canceled, that
 *   holds no unsaved builder work, whose name and overviews match the seed data,
 *   and that nobody has bought, registered or applied for. Anything else is an
 *   admin's (or a member's) and is skipped whole: the event row and everything
 *   hanging off it. `planProdEvents` is that rule, kept free of I/O.
 * - The local prune deletes an event the seed data no longer describes only
 *   when no hand-made account holds anything on it. Applications, tickets,
 *   teams and reviewer notes cascade off `events`, so the delete itself would
 *   not stop to ask; `findEventHolders` asks first.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CROWD_EMAIL_DOMAINS } from "../data/crowd.ts";
import { FORMER_REVIEWER } from "../data/review-notes.ts";
import type { SeedEvent } from "../data/events.ts";
import type { SeedUser } from "../data/users.ts";

const TABLE = {
  events: "events",
  purchases: "purchases",
  eventTickets: "event_tickets",
  eventApplications: "event_applications",
  teamMembers: "team_members",
  reviewNotes: "application_review_notes",
  userInfo: "user_info",
} as const;

/** The columns `planProdEvents` reads from an existing event. */
export interface ExistingEventRow {
  id: string;
  slug: string;
  status: string;
  publish_at: string | null;
  first_published_at: string | null;
  canceled_at: string | null;
  working_document: unknown;
  name: string;
  short_description: string | null;
  description: string | null;
}

const EXISTING_EVENT_COLUMNS =
  "id, slug, status, publish_at, first_published_at, canceled_at, working_document, name, short_description, description";

export type ProdEventDecision =
  | { slug: string; action: "create" }
  | { slug: string; action: "update"; id: string }
  | { slug: string; action: "skip"; id: string; reason: string };

/** The seed data's demo content, which an untouched prod row still carries. */
const CONTENT_FIELDS = ["name", "short_description", "description"] as const;

/**
 * Decides, per seed event, whether a prod run may create it, update the row it
 * wrote earlier, or must leave the existing row alone.
 *
 * `heldEventIds` are events somebody bought, registered or applied for (see
 * `findEventHolders`). A skipped event is skipped whole: its slug is taken by
 * a row the seed cannot prove it owns, so there is nothing to create either.
 */
export function planProdEvents(
  seeds: readonly Pick<SeedEvent, "event">[],
  existing: readonly ExistingEventRow[],
  heldEventIds: ReadonlySet<string>
): ProdEventDecision[] {
  const bySlug = new Map(existing.map((row) => [row.slug, row]));

  return seeds.map(({ event }) => {
    const row = bySlug.get(event.slug);
    if (!row) return { slug: event.slug, action: "create" };

    const skip = (reason: string): ProdEventDecision => ({
      slug: event.slug,
      action: "skip",
      id: row.id,
      reason,
    });

    if (heldEventIds.has(row.id)) return skip("somebody has bought, registered or applied for it");
    if (row.status !== "draft") return skip(`it is ${row.status}`);
    if (row.first_published_at) return skip("it has been published");
    if (row.publish_at) return skip("it is scheduled to publish");
    if (row.canceled_at) return skip("it is canceled");
    if (row.working_document != null) return skip("it holds unsaved builder work");

    const changed = CONTENT_FIELDS.filter(
      (field) => (row[field] ?? null) !== (event[field] ?? null)
    );
    if (changed.length > 0) {
      return skip(
        `its ${changed.join(", ").replaceAll("_", " ")} differ from the seed data ` +
          "(edited in the app, or written by an older seed)"
      );
    }

    return { slug: event.slug, action: "update", id: row.id };
  });
}

/** Reads what `planProdEvents` needs and plans the prod run's events. */
export async function inspectProdEvents(
  supabase: SupabaseClient,
  seeds: readonly SeedEvent[]
): Promise<ProdEventDecision[]> {
  const { data, error } = await supabase
    .from(TABLE.events)
    .select(EXISTING_EVENT_COLUMNS)
    .in("slug", seeds.map((seed) => seed.event.slug));
  if (error) throw new Error(`Reading events failed: ${error.message}`);

  const existing = (data ?? []) as unknown as ExistingEventRow[];
  // Prod has no fixture accounts, so every record on an event is a real one.
  const held = await findEventHolders(
    supabase,
    existing.map((row) => row.id),
    []
  );
  return planProdEvents(seeds, existing, new Set(held.keys()));
}

/** One line per skipped event, for the run's output. */
export function describeSkippedEvents(decisions: readonly ProdEventDecision[]): string[] {
  return decisions.flatMap((decision) =>
    decision.action === "skip"
      ? [`  ! ${decision.slug}: left untouched, ${decision.reason}`]
      : []
  );
}

/**
 * The records on an event that cascade away with it, and the column naming the
 * account that holds each. Purchases are `on delete restrict`, so they could
 * never be lost, but they are checked too so a dry run reports them.
 */
const HOLDINGS = [
  { label: "purchases", table: TABLE.purchases, user: "user_id", event: "event_id" },
  { label: "tickets", table: TABLE.eventTickets, user: "user_id", event: "event_id" },
  { label: "applications", table: TABLE.eventApplications, user: "user_id", event: "event_id" },
  { label: "team memberships", table: TABLE.teamMembers, user: "user_id", event: "event_id" },
  {
    label: "reviewer notes",
    table: TABLE.reviewNotes,
    user: "author_id",
    event: "event_applications.event_id",
    embed: "event_applications!inner(event_id)",
  },
] as const;

/**
 * For each event, what accounts outside `ownedProfileIds` hold on it:
 * purchases, tickets, applications, team memberships or reviewer notes. Events
 * with nothing of the kind are absent from the map.
 */
export async function findEventHolders(
  supabase: SupabaseClient,
  eventIds: readonly string[],
  ownedProfileIds: readonly string[]
): Promise<Map<string, string[]>> {
  const holders = new Map<string, string[]>();
  const owned = [...new Set(ownedProfileIds)];

  for (const eventId of eventIds) {
    for (const holding of HOLDINGS) {
      // Not `id`: `team_members` has none (its key is event and user).
      const columns = "embed" in holding ? `${holding.user}, ${holding.embed}` : holding.user;
      let query = supabase
        .from(holding.table)
        .select(columns, { count: "exact", head: true })
        .eq(holding.event, eventId);
      if (owned.length > 0) {
        query = query.not(holding.user, "in", `(${owned.join(",")})`);
      }

      const { count, error } = await query;
      if (error) {
        throw new Error(`Reading ${holding.table} failed: ${error.message}`);
      }
      if ((count ?? 0) > 0) {
        holders.set(eventId, [...(holders.get(eventId) ?? []), holding.label]);
      }
    }
  }

  return holders;
}

/**
 * The profiles the seed owns: the login fixtures (current and retired), the
 * former reviewer, and every crowd-domain profile without an Auth user, listed
 * or not (the crowd prune deletes the unlisted ones). A crowd-domain profile
 * somebody signed up with has an Auth user, so it is not the seed's.
 *
 * Read from the database rather than taken from the run's reconcile, so it
 * holds for `--only=events` and dry runs too.
 */
export async function fetchSeedOwnedProfileIds(
  supabase: SupabaseClient,
  users: readonly SeedUser[],
  retiredEmails: readonly string[]
): Promise<string[]> {
  const loginEmails = [
    ...users.filter((user) => user.password !== null).map((user) => user.email),
    ...retiredEmails,
    FORMER_REVIEWER.email,
  ];

  const { data: logins, error: loginError } = await supabase
    .from(TABLE.userInfo)
    .select("id")
    .in("email", loginEmails);
  if (loginError) throw new Error(`Reading profiles failed: ${loginError.message}`);

  const { data: crowd, error: crowdError } = await supabase
    .from(TABLE.userInfo)
    .select("id")
    .is("auth_user_id", null)
    .or(CROWD_EMAIL_DOMAINS.map((domain) => `email.like.*@${domain}`).join(","));
  if (crowdError) throw new Error(`Reading crowd profiles failed: ${crowdError.message}`);

  return [...(logins ?? []), ...(crowd ?? [])].map((row) => row.id as string);
}
