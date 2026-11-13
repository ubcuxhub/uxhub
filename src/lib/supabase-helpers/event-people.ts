import type { MentorRow, SponsorRow } from "@/lib/supabase/models";
import { TABLES } from "./tables";
import type { DbClient } from "./types";

/** Compatibility reader for the existing Mentors card. Other groups remain
 * in the editor until section-aware attendee rendering is delivered. */
export async function fetchEventMentors(
  supabase: DbClient,
  eventId: string
): Promise<MentorRow[]> {
  const { data: sections, error: sectionError } = await supabase
    .from(TABLES.eventPeopleSections).select("id, title").eq("event_id", eventId);
  if (sectionError) throw sectionError;
  const mentorSections = (sections ?? []).filter(section => section.title.trim().toLowerCase() === "mentors");
  if (!mentorSections.length) return [];
  const { data: links, error: linksError } = await supabase
    .from(TABLES.eventMentors)
    .select("mentor_id, sort_order")
    .eq("event_id", eventId)
    .in("section_id", mentorSections.map(section => section.id))
    .order("sort_order", { ascending: true });

  if (linksError) throw linksError;
  if (!links?.length) return [];

  const { data: mentors, error } = await supabase
    .from(TABLES.mentors)
    .select("*")
    .in(
      "id",
      links.map((link) => link.mentor_id)
    );

  if (error) throw error;
  const byId = new Map((mentors ?? []).map((mentor) => [mentor.id, mentor]));
  return links
    .map((link) => byId.get(link.mentor_id))
    .filter((mentor): mentor is MentorRow => Boolean(mentor));
}

export async function fetchEventSponsors(
  supabase: DbClient,
  eventId: string
): Promise<SponsorRow[]> {
  const { data: links, error: linksError } = await supabase
    .from(TABLES.eventSponsors)
    .select("sponsor_id, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (linksError) throw linksError;
  if (!links?.length) return [];

  const { data: sponsors, error } = await supabase
    .from(TABLES.sponsors)
    .select("*")
    .in(
      "id",
      links.map((link) => link.sponsor_id)
    );

  if (error) throw error;
  const byId = new Map((sponsors ?? []).map((sponsor) => [sponsor.id, sponsor]));
  return links
    .map((link) => byId.get(link.sponsor_id))
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
