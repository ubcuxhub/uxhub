/**
 * People sections against the local database: the builder's save writes its
 * mentors into the event's Mentors section and leaves other sections alone,
 * and the table's keys keep sections and their people consistent.
 */
import { describe, expect, it } from "vitest";

import { fetchEventMentors } from "@/lib/supabase-helpers/event-people";
import { withFixtures, type Fixtures } from "@/test/integration";

/** Postgres's unique_violation and foreign_key_violation. */
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/** Create mentors before the event, so cleanup deletes the event's links first. */
async function createMentors(fixtures: Fixtures, ...names: string[]) {
  const { data, error } = await fixtures.supabase
    .from("mentors")
    .insert(names.map((name) => ({ full_name: `${name} ${fixtures.tag}` })))
    .select("id, full_name");
  if (error) throw error;
  for (const mentor of data) fixtures.track("mentors", mentor.id);
  return data;
}

async function save(fixtures: Fixtures, mentorIds: string[], eventId?: string) {
  const { data, error } = await fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId ?? null!,
    p_event: {
      name: `People sections ${fixtures.tag}`,
      description: "People sections integration test.",
      status: "active",
      regular_price: 10,
      member_price: 5,
      max_capacity: 10,
    },
    p_slug: `people-sections-${fixtures.tag}`,
    p_expected_image_url: null!,
    p_check_in_sessions: [],
    p_application_questions: [],
    p_mentors: mentorIds,
    p_sponsors: [],
  });
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (!eventId) fixtures.track("events", id);
  return id;
}

async function addSection(fixtures: Fixtures, eventId: string, title: string, sortOrder = 0) {
  const { data, error } = await fixtures.supabase
    .from("event_people_sections")
    .insert({ event_id: eventId, title, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sectionsOf(fixtures: Fixtures, eventId: string) {
  const { data, error } = await fixtures.supabase
    .from("event_people_sections")
    .select("title, sort_order, event_mentors(mentor_id, sort_order)")
    .eq("event_id", eventId)
    .order("sort_order");
  if (error) throw error;
  return data.map((section) => ({
    ...section,
    event_mentors: [...section.event_mentors].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

describe("save_admin_event_atomically and people sections", () => {
  it("puts the builder's mentors in a Mentors section, made on first save", () =>
    withFixtures(async (fixtures) => {
      const [ada, grace, alan] = await createMentors(fixtures, "Ada", "Grace", "Alan");

      const eventId = await save(fixtures, [ada.id, grace.id]);
      expect(await sectionsOf(fixtures, eventId)).toEqual([
        {
          title: "Mentors",
          sort_order: 0,
          event_mentors: [
            { mentor_id: ada.id, sort_order: 0 },
            { mentor_id: grace.id, sort_order: 1 },
          ],
        },
      ]);

      // A later save replaces the list and its order, in the same section.
      await save(fixtures, [alan.id, ada.id], eventId);
      expect(await sectionsOf(fixtures, eventId)).toEqual([
        {
          title: "Mentors",
          sort_order: 0,
          event_mentors: [
            { mentor_id: alan.id, sort_order: 0 },
            { mentor_id: ada.id, sort_order: 1 },
          ],
        },
      ]);
    }));

  it("makes no section for an event saved without mentors", () =>
    withFixtures(async (fixtures) => {
      const eventId = await save(fixtures, []);
      expect(await sectionsOf(fixtures, eventId)).toEqual([]);
    }));

  it("leaves sections it doesn't know alone, and adds Mentors after them", () =>
    withFixtures(async (fixtures) => {
      const [ada, grace] = await createMentors(fixtures, "Ada", "Grace");
      const eventId = await save(fixtures, []);
      const judges = await addSection(fixtures, eventId, "Judges");
      const { error } = await fixtures.supabase.from("event_mentors").insert({
        event_id: eventId,
        section_id: judges.id,
        mentor_id: grace.id,
      });
      if (error) throw error;

      await save(fixtures, [ada.id, grace.id], eventId);
      await save(fixtures, [ada.id], eventId);

      // Grace still judges after leaving the mentors; Ada mentors.
      expect(await sectionsOf(fixtures, eventId)).toEqual([
        { title: "Judges", sort_order: 0, event_mentors: [{ mentor_id: grace.id, sort_order: 0 }] },
        { title: "Mentors", sort_order: 1, event_mentors: [{ mentor_id: ada.id, sort_order: 0 }] },
      ]);
    }));
});

describe("event_people_sections", () => {
  it("lets one person sit in two sections of the same event", () =>
    withFixtures(async (fixtures) => {
      const [ada] = await createMentors(fixtures, "Ada");
      const eventId = await save(fixtures, [ada.id]);
      const judges = await addSection(fixtures, eventId, "Judges", 1);

      const { error } = await fixtures.supabase.from("event_mentors").insert({
        event_id: eventId,
        section_id: judges.id,
        mentor_id: ada.id,
      });
      expect(error).toBeNull();
    }));

  it("allows one section per title per event, ignoring case and spaces", () =>
    withFixtures(async (fixtures) => {
      const eventId = await save(fixtures, []);
      await addSection(fixtures, eventId, "Judges");

      const { error } = await fixtures.supabase
        .from("event_people_sections")
        .insert({ event_id: eventId, title: " judges " });
      expect(error?.code).toBe(UNIQUE_VIOLATION);
    }));

  it("refuses a link to another event's section", () =>
    withFixtures(async (fixtures) => {
      const [ada] = await createMentors(fixtures, "Ada");
      const eventId = await save(fixtures, []);
      const other = await fixtures.createEvent();
      const otherSection = await addSection(fixtures, other.id, "Speakers");

      const { error } = await fixtures.supabase.from("event_mentors").insert({
        event_id: eventId,
        section_id: otherSection.id,
        mentor_id: ada.id,
      });
      expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    }));

  it("takes its people with it when deleted", () =>
    withFixtures(async (fixtures) => {
      const [ada] = await createMentors(fixtures, "Ada");
      const eventId = await save(fixtures, [ada.id]);

      const { error } = await fixtures.supabase
        .from("event_people_sections")
        .delete()
        .eq("event_id", eventId);
      if (error) throw error;

      const { count } = await fixtures.supabase
        .from("event_mentors")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);
      expect(count).toBe(0);
    }));
});

describe("fetchEventMentors", () => {
  it("lists only the Mentors section, in order", () =>
    withFixtures(async (fixtures) => {
      const [ada, grace, alan] = await createMentors(fixtures, "Ada", "Grace", "Alan");
      const eventId = await save(fixtures, [grace.id, ada.id]);
      const judges = await addSection(fixtures, eventId, "Judges", 1);
      const { error } = await fixtures.supabase.from("event_mentors").insert([
        { event_id: eventId, section_id: judges.id, mentor_id: alan.id },
        { event_id: eventId, section_id: judges.id, mentor_id: ada.id },
      ]);
      if (error) throw error;

      const mentors = await fetchEventMentors(fixtures.supabase, eventId);
      expect(mentors.map((mentor) => mentor.id)).toEqual([grace.id, ada.id]);
    }));
});
