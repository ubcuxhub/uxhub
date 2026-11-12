import { safeContentUrl } from "../../../src/features/admin/lib/event-content.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeedEvent } from "../data/events.ts";
import type { SeedUser } from "../data/users.ts";
import type { ReconcileOptions } from "./reconcile.ts";

/** Validate fixtures before storage, database or Auth writes, including --only runs. */
export function validateSeedEvents(events: SeedEvent[]): void {
  const slugs = new Set<string>();
  for (const { event, privateDetails, checkInSessions, links } of events) {
    const fail = (message: string): never => { throw new Error(`Event "${event.slug}": ${message}`); };
    if (slugs.has(event.slug)) fail("duplicate slug");
    slugs.add(event.slug);
    if (!event.short_description?.trim() || event.short_description.length > 50) fail("short overview must be 1–50 characters");
    if (!event.description.trim() || event.description.length > 3000) fail("long overview must be 1–3000 characters");
    const price = Number(event.configured_price);
    if (event.pricing_policy !== "figma" || !["free", "paid"].includes(event.configured_pricing_mode ?? "") ||
        event.configured_price == null || !Number.isFinite(price) || price < 0 || price >= 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001 ||
        (event.configured_pricing_mode === "free" && price !== 0) || Number(event.regular_price) !== price || event.member_price !== 0) fail("invalid operational pricing");
    if (event.configured_slug !== event.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(event.slug)) fail("invalid configured URL");
    if (!["hosted", "external", "disabled"].includes(event.configured_marketing_mode ?? "")) fail("marketing mode is required");
    if (event.configured_marketing_mode === "external") {
      if (!safeContentUrl(event.configured_marketing_url ?? "")) fail("invalid external marketing URL");
    }
    for (const [start, end] of [[event.starts_at, event.ends_at], [event.registration_opens_at, event.registration_closes_at]]) {
      if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(start) >= Date.parse(end)) fail("invalid date window");
    }
    if (!Number.isInteger(event.max_capacity) || Number(event.max_capacity) < 0) fail("invalid capacity");
    for (const session of checkInSessions) {
      if (!session.name || !session.start_time || !session.end_time || !Number.isFinite(Date.parse(session.start_time)) || !Number.isFinite(Date.parse(session.end_time)) || Date.parse(session.start_time) >= Date.parse(session.end_time)) fail("invalid check-in window");
    }
    if (links?.some(link => !safeContentUrl(link.url))) fail("invalid resource URL");
    if (privateDetails?.meeting_url && !safeContentUrl(privateDetails.meeting_url)) fail("invalid meeting URL");
    if (event.location_type !== "in_person" && event.location_type !== undefined && !privateDetails?.meeting_url) fail("online/hybrid meeting details are required");
  }
}

/**
 * Local-only conversion removes fixture-owned price locks rather than weakening
 * database guards. Event/application/question/team identities and durable question
 * locks survive. A partial failure is recoverable by rerunning the local seed.
 */
export async function prepareLegacySeedPricing(
  client: SupabaseClient,
  events: SeedEvent[],
  users: SeedUser[],
  options: ReconcileOptions & { target: string; users: boolean }
): Promise<number> {
  const { data, error } = await client.from("events").select("id,slug,pricing_policy,configured_pricing_mode,configured_price,regular_price,member_price")
    .in("slug", events.map(seed => seed.event.slug));
  if (error) throw error;
  const changes = (data ?? []).filter(row => {
    const wanted = events.find(seed => seed.event.slug === row.slug)!.event;
    return row.pricing_policy !== "figma" || row.configured_pricing_mode !== wanted.configured_pricing_mode ||
      row.configured_price !== wanted.configured_price || row.regular_price !== wanted.regular_price || row.member_price !== 0;
  });
  if (!changes.length) return 0;
  const { data: profiles, error: profileError } = await client.from("user_info").select("id,email,auth_user_id").in("email", users.map(user => user.email));
  if (profileError) throw profileError;
  const fixtureIds = new Set((profiles ?? []).filter(profile => {
    const fixture = users.find(user => user.email === profile.email);
    return fixture && (fixture.password !== null || profile.auth_user_id === null);
  }).map(profile => profile.id as string));
  // Inspect all candidate events before deleting any fixture records. A handmade
  // account keeps both its records and the event's original financial settings.
  for (const event of changes) {
    for (const table of ["purchases", "event_tickets", "event_applications"]) {
      const { data: rows, error: readError } = await client.from(table).select("user_id").eq("event_id", event.id);
      if (readError) throw readError;
      const outsiderQuery = client.from(table).select("user_id").eq("event_id", event.id);
      const outsiders = fixtureIds.size ? await outsiderQuery.not("user_id", "in", `(${[...fixtureIds].join(",")})`).limit(1) : await outsiderQuery.limit(1);
      if (outsiders.error) throw outsiders.error;
      if (outsiders.data?.length) throw new Error(`Cannot reprice "${event.slug}": ${table} contains non-fixture records. Preserve them; use a separate fresh local database for the new fixtures.`);
      if (rows?.length && (options.target !== "local" || !options.prune || !options.users)) {
        throw new Error(`Repricing "${event.slug}" requires a full local seed with pruning (no --only or --no-prune). Existing registrations lock pricing.`);
      }
    }
  }
  if (options.dryRun || options.target !== "local" || !options.prune || !options.users) return changes.length;
  for (const event of changes) {
    const ids = [...fixtureIds];
    for (let offset = 0; offset < ids.length; offset += 40) {
      const batch = ids.slice(offset, offset + 40);
      // Accepted offers also lock prices. Keep the application, answers, notes
      // and files; the user pass restores the fixture offer timestamp.
      const offer = await client.from("event_applications").update({ offer_expires_at: "2000-01-01T00:00:00.000Z" }).eq("event_id", event.id).in("user_id", batch).eq("status", "accepted");
      if (offer.error) throw offer.error;
      for (const table of ["event_tickets", "purchases"]) {
        const result = await client.from(table).delete().eq("event_id", event.id).in("user_id", batch);
        if (result.error) throw result.error;
      }
    }
  }
  return changes.length;
}
