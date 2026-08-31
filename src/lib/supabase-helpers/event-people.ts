import type {
  MentorInsert,
  MentorRow,
  MentorUpdate,
  SponsorInsert,
  SponsorRow,
  SponsorUpdate,
} from "@/types/models";
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
