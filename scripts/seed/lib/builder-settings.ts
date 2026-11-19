import { pacificTimestamp, vancouverWallClockMs } from "./relative-dates.ts";
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
  const wall = new Date(vancouverWallClockMs(Date.parse(value))).toISOString();
  return { date: wall.slice(0,10), time: wall.slice(11,16) };
}

/** Selected single/multiple-date fixtures exercise saved editor settings. */
export function seedDateLocation(seed: SeedEvent): EventDateLocationDraft | null {
  if (seed.dateLocation?.version === 2) return structuredClone(seed.dateLocation);
  const event = seed.event;
  const location = {
    type: event.location_type ?? "in_person", building: event.location_building ?? "", room: event.location_room ?? "",
    address: event.location_address ?? "6133 University Boulevard, Vancouver, BC (demo)", map_url: event.location_address_url ?? "",
    meeting_url: seed.privateDetails?.meeting_url ?? "", meeting_id: seed.privateDetails?.meeting_id ?? "",
    meeting_passcode: seed.privateDetails?.meeting_passcode ?? "", public_summary: "UBC Vancouver — details after registration",
  };
  const dates: EventDateLocationDraft["dates"] = (seed.agendaDays ?? []).map((day, index) => {
    const date = day.date.toISOString().slice(0,10);
    return { key: seedId(`${event.slug}:day:${date}`), session_id: null, date, start: "", end: "", label: day.title || `Day ${index + 1}`, location: { ...location },
      items: day.items.map((item, position) => ({ key: seedId(`${event.slug}:${date}:item:${position}`), session_id: null, label: item.title, start: item.start, end_date: date, end: item.end, description: "", check_in: false,
        location: item.building || item.room ? { ...location, building: item.building ?? location.building, room: item.room ?? location.room } : null })) };
  });
  for (const [index, session] of seed.checkInSessions.entries()) {
    const start = pacificParts(session.start_time); const end = pacificParts(session.end_time);
    let day = dates.find(day => day.date === start.date);
    if (!day) { day = { key: seedId(`${event.slug}:day:${start.date}`), session_id: null, date: start.date, start: "", end: "", label: `Day ${dates.length + 1}`, location: { ...location }, items: [] }; dates.push(day); }
    const match = day.items!.find(item => item.label === session.name && item.start === start.time && item.end === end.time && item.end_date === end.date);
    if (match) match.check_in = true;
    else day.items!.push({ key: seedId(`${event.slug}:session:${index}`), session_id: null, label: session.name, start: start.time, end_date: end.date, end: end.time, description: "", check_in: true, location: null });
  }
  if (!dates.length) {
    const start = pacificParts(event.starts_at); const end = pacificParts(event.ends_at);
    dates.push({ key: seedId(`${event.slug}:day:${start.date}`), session_id: null, date: start.date, start: "", end: "", label: "Event day", location: { ...location }, items: [{ key: seedId(`${event.slug}:main`), session_id: null, label: event.name ?? "Event", start: start.time, end_date: end.date, end: end.time, check_in: false, description: "", location: null }] });
  }
  dates.sort((a,b) => a.date.localeCompare(b.date));
  for (const day of dates) {
    const starts = day.items!.map(item => pacificTimestamp(new Date(`${day.date}T12:00:00Z`), item.start)).sort();
    const ends = day.items!.map(item => pacificTimestamp(new Date(`${item.end_date}T12:00:00Z`), item.end)).sort();
    Object.assign(day, { start: pacificParts(starts[0]).time, end: pacificParts(ends.at(-1)).time, start_time: starts[0], end_time: ends.at(-1) });
  }
  return { version: 2, automatic: true, audience: event.slug === "thinkbox-office-tour" ? "going" : "everyone", location, dates };
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
    starts_at: document.dates.flatMap(day => (day.items ?? []).map(item => pacificTimestamp(new Date(`${day.date}T12:00:00Z`), item.start))).sort()[0],
    ends_at: document.dates.flatMap(day => (day.items ?? []).map(item => pacificTimestamp(new Date(`${item.end_date}T12:00:00Z`), item.end))).sort().at(-1),
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
  const storedDays = await client.from("event_agenda_days").select("id,date,items:event_agenda_items(id,title)").eq("event_id",eventId);
  if (storedDays.error) throw storedDays.error;
  for (const day of locations.dates) {
    const stored = storedDays.data.find(row => row.date === day.date);
    if (stored) day.key = stored.id;
    const start_time = (day as unknown as { start_time: string }).start_time;
    const end_time = (day as unknown as { end_time: string }).end_time;
    const upsert = await client.from("event_agenda_days").upsert({ id: day.key, event_id: eventId, date: day.date, title: day.label, starts_at: start_time, ends_at: end_time });
    if (upsert.error) throw upsert.error;
    for (const item of day.items ?? []) {
      item.key = stored?.items.find(row => row.title === item.label)?.id ?? item.key;
      item.session_id = item.check_in ? sessions.data.find(session => session.name === item.label)?.id ?? null : null;
      const effective = item.location ?? day.location!;
      const inserted = await client.from("event_agenda_items").upsert({ id: item.key, event_agenda_day_id: day.key, title: item.label, start_time: item.start, end_time: item.end,
        starts_at: pacificTimestamp(new Date(`${day.date}T12:00:00Z`),item.start), ends_at: pacificTimestamp(new Date(`${item.end_date}T12:00:00Z`),item.end), description: item.description, check_in: item.check_in,
        building: locations.audience === "going" ? effective.public_summary : effective.type === "online" ? "Online" : effective.building, room: locations.audience === "everyone" && effective.type !== "online" ? effective.room || null : null });
      if (inserted.error) throw inserted.error;
      if (item.session_id) {
        const linked = await client.from("check_in_sessions").update({ agenda_item_id: item.key }).eq("id",item.session_id);
        if (linked.error) throw linked.error;
      }
    }
  }
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
  const content: EventContent = { revision: 0, sections: [], links: [], resources_version: 2 };
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
  if (seed.staffVolunteerSchedule) content.links.push({ id: seedId(`${eventId}:volunteer-schedule`), type: "volunteer_schedule", label: "Volunteer Schedule", url: seed.staffVolunteerSchedule, visibility: "staff" });
  await writeDocument(client, "event_content_settings", eventId, content);
  if (seed.applicationQuestions.length) {
    const start = Date.parse(seed.event.registration_closes_at!);
    // Release an hour after applications close, but only once that has
    // passed: a later release would hide the fixtures' decisions, and the
    // database refuses to move a passed release into the future on a re-run.
    const release = start + 3600000 <= Date.now() ? new Date(start + 3600000).toISOString() : null;
    const result = await client.from("event_application_settings").upsert({ event_id: eventId, decisions_release_at: release, confirmation_deadline: new Date(start + 86400000).toISOString() });
    if (result.error) throw result.error;
  }
}
