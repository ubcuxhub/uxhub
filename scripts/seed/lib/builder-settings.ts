import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeedEvent } from "../data/events.ts";
import type { EventDateLocationDraft } from "../../../src/features/admin/lib/event-date-location.ts";
import type { EventContent, PeopleGroup } from "../../../src/features/admin/lib/event-content.ts";

function seedId(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function pacificParts(value: string | null | undefined) {
  if (!value) throw new Error("Seed date requires a timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** Selected single/multiple-date fixtures exercise saved editor settings. */
export function seedDateLocation(seed: SeedEvent): EventDateLocationDraft | null {
  if (seed.dateLocation) return structuredClone(seed.dateLocation);
  if (!["design-sprint-upcoming", "student-panel", "ux-research-workshop", "thinkbox-office-tour"].includes(seed.event.slug)) return null;
  const event = seed.event;
  const location = {
    type: event.location_type ?? "in_person", building: event.location_building ?? "", room: event.location_room ?? "",
    address: event.location_address ?? "6133 University Boulevard, Vancouver, BC (demo)", map_url: event.location_address_url ?? "",
    meeting_url: seed.privateDetails?.meeting_url ?? "", meeting_id: seed.privateDetails?.meeting_id ?? "",
    meeting_passcode: seed.privateDetails?.meeting_passcode ?? "", public_summary: "UBC Vancouver — details after registration",
  };
  return {
    automatic: true, audience: event.slug === "thinkbox-office-tour" ? "going" : "everyone", location,
    dates: seed.checkInSessions.map((session, index) => {
      const start = pacificParts(session.start_time);
      const end = pacificParts(session.end_time);
      return { key: seedId(`${event.slug}:date:${index}`), session_id: null, date: start.date, start: start.time, end: end.time, label: session.name,
        start_time: session.start_time, end_time: session.end_time,
        location: event.slug === "thinkbox-office-tour" && index === 1 ? { ...location, room: "Demo meeting room B" } : null };
    }),
  };
}

async function writeDocument(client: SupabaseClient, table: string, eventId: string, document: object): Promise<void> {
  const existing = await client.from(table).select("document,revision").eq("event_id", eventId).maybeSingle();
  if (existing.error) throw existing.error;
  // Ignore JSON object key ordering and the content document's revision when
  // deciding whether a repeat run really changed the saved settings.
  const canonical = (value: unknown): string => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "revision").sort(([a], [b]) => a.localeCompare(b))) : item);
  if (existing.data && canonical(existing.data.document) === canonical(document)) return;
  const revision = (existing.data?.revision ?? 0) + 1;
  const result = await client.from(table).upsert({ event_id: eventId, revision, document: table === "event_content_settings" ? { ...document, revision } : document });
  if (result.error) throw result.error;
}

/** Public projection of the selected saved settings, matching the database guard. */
export function seedEventProjection(seed: SeedEvent) {
  const document = seedDateLocation(seed);
  if (!document) return {};
  const physical = document.audience === "everyone" && document.location.type !== "online";
  return {
    starts_at: seed.checkInSessions.map(session => session.start_time).sort()[0],
    ends_at: seed.checkInSessions.map(session => session.end_time).sort().at(-1),
    location_type: document.location.type,
    location_building: document.audience === "going" ? document.location.public_summary : document.location.type === "online" ? "Online" : document.location.building,
    location_room: physical ? document.location.room || null : null,
    location_address: physical ? document.location.address || null : null,
    location_address_url: physical ? document.location.map_url || null : null,
  };
}

async function writeDateSettings(client: SupabaseClient, eventId: string, seed: SeedEvent) {
  const locations = seedDateLocation(seed);
  if (!locations) return;
  const sessions = await client.from("check_in_sessions").select("id,name").eq("event_id", eventId);
  if (sessions.error) throw sessions.error;
  for (const date of locations.dates) date.session_id = sessions.data.find(session => session.name === date.label)?.id ?? null;
  await writeDocument(client, "event_date_location_settings", eventId, locations);
}

/** Refresh derived windows before an event upsert encounters the date guard. */
export async function prepareBuilderDateSettings(client: SupabaseClient, seeds: SeedEvent[]) {
  const events = await client.from("events").select("id,slug").in("slug", seeds.map(seed => seed.event.slug));
  if (events.error) throw events.error;
  for (const event of events.data ?? []) {
    const seed = seeds.find(item => item.event.slug === event.slug)!;
    await writeDateSettings(client, event.id, seed);
  }
}

/** Uses real reconciled identities so a builder save retains existing children. */
export async function reconcileBuilderSettings(client: SupabaseClient, eventId: string, seed: SeedEvent): Promise<void> {
  await writeDateSettings(client, eventId, seed);
  const sections = await client.from("event_people_sections").select("id,title,sort_order").eq("event_id", eventId).order("sort_order");
  const people = await client.from("event_mentors").select("section_id,sort_order,mentors(*)").eq("event_id", eventId).order("sort_order");
  const sponsors = await client.from("event_sponsors").select("sort_order,sponsors(*)").eq("event_id", eventId).order("sort_order");
  const links = await client.from("event_links").select("*").eq("event_id", eventId).order("sort_order");
  for (const result of [sections, people, sponsors, links]) if (result.error) throw result.error;
  // This script uses an untyped Supabase client; normalize nested relationships
  // explicitly instead of importing the server-only helper tree into Node.
  const content: EventContent = { revision: 0, sections: [], links: [] };
  for (const section of sections.data ?? []) {
    content.sections.push({ key: section.id, kind: (["Judges", "Mentors", "Speakers", "Panelists"].includes(section.title) ? section.title : "custom") as PeopleGroup, title: section.title,
      items: (people.data ?? []).filter(row => row.section_id === section.id).map(row => {
        const person = row.mentors as unknown as { id: string; full_name: string; position: string; description: string; linkedin_url: string; profile_image_path: string };
        return { key: seedId(`${eventId}:${section.id}:${person.id}`), directory_id: person.id, name: person.full_name, position: person.position ?? "", description: person.description ?? "", url: person.linkedin_url ?? "", image_url: person.profile_image_path ?? "" };
      }) });
  }
  if (sponsors.data?.length) content.sections.push({ key: seedId(`${eventId}:sponsors`), kind: "Sponsors", title: "Sponsors", items: sponsors.data.map(row => {
    const sponsor = row.sponsors as unknown as { id: string; name: string; description: string; website_url: string; brand_logo_path: string };
    return { key: seedId(`${eventId}:${sponsor.id}`), directory_id: sponsor.id, name: sponsor.name, position: "", description: sponsor.description ?? "", url: sponsor.website_url ?? "", image_url: sponsor.brand_logo_path ?? "" };
  }) });
  content.links = (links.data ?? []).map(row => ({ id: row.id, type: row.type, label: row.label ?? "", url: row.url, visibility: row.visibility, label_edited: true, audience_edited: true }));
  await writeDocument(client, "event_content_settings", eventId, content);
  if (seed.applicationQuestions.length) {
    const start = Date.parse(seed.event.registration_closes_at!);
    const result = await client.from("event_application_settings").upsert({ event_id: eventId, decisions_release_at: new Date(start + 3600000).toISOString(), confirmation_deadline: new Date(start + 86400000).toISOString() });
    if (result.error) throw result.error;
  }
}
