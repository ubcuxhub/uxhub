import type {
  MentorInsert,
  MentorRow,
  MentorUpdate,
  SponsorInsert,
  SponsorRow,
  SponsorUpdate,
} from "@/lib/supabase/models";
import { TABLES } from "./tables";
import type { DbClient } from "./types";

export interface MentorInput {
  id?: string;
  full_name: string;
  position?: string | null;
  linkedin_url?: string | null;
  description?: string | null;
  profile_image_path?: string | null;
}

export interface SponsorInput {
  id?: string;
  name: string;
  brand_logo_path?: string | null;
}

export async function saveMentor(
  supabase: DbClient,
  input: MentorInput
): Promise<MentorRow> {
  const payload: MentorInsert | MentorUpdate = {
    full_name: input.full_name.trim(),
    position: input.position?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
    description: input.description?.trim() || null,
    profile_image_path: input.profile_image_path?.trim() || null,
  };
  const request = input.id
    ? supabase.from(TABLES.mentors).update(payload).eq("id", input.id)
    : supabase.from(TABLES.mentors).insert(payload as MentorInsert);
  const { data, error } = await request.select("*").single();
  if (error) throw error;
  return data;
}

export async function saveSponsor(
  supabase: DbClient,
  input: SponsorInput
): Promise<SponsorRow> {
  const payload: SponsorInsert | SponsorUpdate = {
    name: input.name.trim(),
    brand_logo_path: input.brand_logo_path?.trim() || null,
  };
  const request = input.id
    ? supabase.from(TABLES.sponsors).update(payload).eq("id", input.id)
    : supabase.from(TABLES.sponsors).insert(payload as SponsorInsert);
  const { data, error } = await request.select("*").single();
  if (error) throw error;
  return data;
}

/**
 * Every person linked to the event, in order, across all its people sections
 * (someone in two sections appears twice). Use `fetchEventPeopleSections` to
 * show them by section.
 */
export async function fetchEventMentors(
  supabase: DbClient,
  eventId: string
): Promise<MentorRow[]> {
  const { data: links, error: linksError } = await supabase
    .from(TABLES.eventMentors)
    .select("mentor_id, sort_order")
    .eq("event_id", eventId)
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
 */
export async function fetchEventPeopleSections(
  supabase: DbClient,
  eventId: string
): Promise<EventPeopleSection[]> {
  const [sectionsResult, linksResult] = await Promise.all([
    supabase
      .from(TABLES.eventPeopleSections)
      .select("id, title")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from(TABLES.eventMentors)
      .select("section_id, mentor_id, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
  ]);

  if (sectionsResult.error) throw sectionsResult.error;
  if (linksResult.error) throw linksResult.error;
  const sections = sectionsResult.data ?? [];
  const links = linksResult.data ?? [];
  if (!sections.length || !links.length) return [];

  const { data: mentors, error } = await supabase
    .from(TABLES.mentors)
    .select("*")
    .in("id", [...new Set(links.map((link) => link.mentor_id))]);

  if (error) throw error;
  const byId = new Map((mentors ?? []).map((mentor) => [mentor.id, mentor]));

  return sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      people: links
        .filter((link) => link.section_id === section.id)
        .map((link) => byId.get(link.mentor_id))
        .filter((mentor): mentor is MentorRow => Boolean(mentor)),
    }))
    .filter((section) => section.people.length > 0);
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
    .order("name")
    .limit(20);

  if (query.trim()) {
    request = request.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
