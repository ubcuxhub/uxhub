import { emptyContent, parseEventContent, PEOPLE_GROUPS, type ContentEntry, type EventContent, type PeopleGroup, type ResourceLink } from "@/features/admin/lib/event-content";
import { TABLES } from "./tables";
import type { DbClient } from "./types";
import type { MentorRow, SponsorRow } from "@/lib/supabase/models";
import { fetchEventLinks } from "./event-links";

export function personContentEntry(row: MentorRow): ContentEntry {
  return { key: row.owner_event_id ? row.id : crypto.randomUUID(), directory_id: row.owner_event_id ? null : row.id, name: row.full_name, position: row.position ?? "", description: row.description ?? "", url: row.linkedin_url ?? "", image_url: row.profile_image_path ?? "" };
}
export function sponsorContentEntry(row: SponsorRow): ContentEntry {
  return { key: row.owner_event_id ? row.id : crypto.randomUUID(), directory_id: row.owner_event_id ? null : row.id, name: row.name, position: "", description: row.description ?? "", url: row.website_url ?? "", image_url: row.brand_logo_path ?? "" };
}
/** Staff-only settings use the viewer client, including during legacy backfill. */
export async function fetchEventContent(supabase: DbClient, eventId: string): Promise<EventContent> {
  const { data, error } = await supabase.from(TABLES.eventContentSettings).select("document").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  const staffSchedule = await fetchStaffVolunteerSchedule(supabase, eventId);
  if (data) return withStaffSchedule(parseEventContent(data.document), staffSchedule);
  const results = await Promise.all([
    supabase.from(TABLES.eventPeopleSections).select("*").eq("event_id", eventId).order("sort_order").order("id"),
    supabase.from(TABLES.eventMentors).select("*, mentors(*)").eq("event_id", eventId).order("sort_order"),
    supabase.from(TABLES.eventSponsors).select("*, sponsors(*)").eq("event_id", eventId).order("sort_order"),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [sections, people, sponsors] = results;
  const content = emptyContent();
  content.sections = (sections.data ?? []).map(section => ({ key: section.id, kind: PEOPLE_GROUPS.find(kind => kind.toLowerCase() === section.title.trim().toLowerCase()) ?? "custom" as PeopleGroup, title: PEOPLE_GROUPS.find(kind => kind.toLowerCase() === section.title.trim().toLowerCase()) ?? section.title,
    items: (people.data ?? []).filter(link => link.section_id === section.id && link.mentors).map(link => personContentEntry(link.mentors!)) }));
  if (sponsors.data?.length) {
    const items = sponsors.data.filter(link => link.sponsors).map(link => sponsorContentEntry(link.sponsors!));
    const existing = content.sections.find(section => section.kind === "Sponsors");
    if (existing) existing.items = items;
    else content.sections.push({ key: crypto.randomUUID(), kind: "Sponsors", title: "Sponsors", items });
  }
  content.links = (await fetchEventLinks(supabase, eventId)).map(row => ({ id: row.id, type: row.type, label: row.label ?? "", url: row.url, visibility: row.visibility, label_edited: true, audience_edited: true }));
  return withStaffSchedule(content, staffSchedule);
}

/** Staff-only reader for the admin agenda. Always pass the viewer client so RLS
 * applies; generic participant link readers never query this storage. */
export async function fetchStaffVolunteerSchedule(supabase: DbClient, eventId: string): Promise<(ResourceLink & { sort_order: number }) | null> {
  const { data, error } = await supabase.from(TABLES.eventStaffVolunteerSchedules).select("id,url,label,sort_order").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, type: "volunteer_schedule", visibility: "staff", url: data.url, label: data.label, label_edited: true, sort_order: data.sort_order } : null;
}

function withStaffSchedule(content: EventContent, schedule: (ResourceLink & { sort_order: number }) | null): EventContent {
  const links = content.links.filter(link => link.type !== "volunteer_schedule");
  if (schedule) {
    const { sort_order, ...link } = schedule;
    links.splice(Math.min(sort_order, links.length), 0, link);
  }
  return { ...content, resources_version: 2, links };
}
