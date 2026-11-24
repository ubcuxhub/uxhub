import type { MentorRow, SponsorRow } from "@/lib/supabase/models";
import { TABLES } from "./tables";
import type { DbClient } from "./types";

/** Compatibility reader for the existing Mentors card: the people in the
 * event's sections titled "Mentors", in page order. Other groups remain in
 * the editor until section-aware attendee rendering is delivered. */
export async function fetchEventMentors(
  supabase: DbClient,
  eventId: string
): Promise<MentorRow[]> {
  const sections = await fetchEventPeopleSections(supabase, eventId);
  return sections
    .filter((section) => section.title.trim().toLowerCase() === "mentors")
    .flatMap((section) => section.people);
}

/** One people section on an event page: its title, and its people in order. */
export interface EventPeopleSection {
  id: string;
  title: string;
  people: MentorRow[];
}

/**
 * The event's people sections (Judges, Mentors, Speakers, Panelists, or a
 * custom title) in their page order, each with its people in order. A person
 * can sit in several sections. Sections with nobody in them are left out.
 * One round trip: each section embeds its links and their people.
 */
export async function fetchEventPeopleSections(
  supabase: DbClient,
  eventId: string
): Promise<EventPeopleSection[]> {
  const { data, error } = await supabase
    .from(TABLES.eventPeopleSections)
    .select("id, title, event_mentors!event_mentors_section_id_fkey(sort_order, mentors(*))")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("sort_order", { referencedTable: "event_mentors", ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((section) => ({
      id: section.id,
      title: section.title,
      people: section.event_mentors
        .map((link) => link.mentors)
        .filter((mentor): mentor is MentorRow => Boolean(mentor)),
    }))
    .filter((section) => section.people.length > 0);
}

/** The event's sponsors in page order, in one round trip. */
export async function fetchEventSponsors(
  supabase: DbClient,
  eventId: string
): Promise<SponsorRow[]> {
  const { data, error } = await supabase
    .from(TABLES.eventSponsors)
    .select("sort_order, sponsors(*)")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((link) => link.sponsors)
    .filter((sponsor): sponsor is SponsorRow => Boolean(sponsor));
}

export async function searchMentors(
  supabase: DbClient,
  query: string
): Promise<MentorRow[]> {
  let request = supabase
    .from(TABLES.mentors)
    .select("*")
    .is("owner_event_id", null)
    .order("full_name")
    .limit(20);

  if (query.trim()) {
    request = request.ilike("full_name", `%${query.trim()}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function searchSponsors(
  supabase: DbClient,
  query: string
): Promise<SponsorRow[]> {
  let request = supabase
    .from(TABLES.sponsors)
    .select("*")
    .is("owner_event_id", null)
    .order("name")
    .limit(20);

  if (query.trim()) {
    request = request.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
