/**
 * The event builder's page settings on `events` against the local database:
 * their defaults, the header and colour rules, and that the builder's save
 * function writes them only when its payload names them.
 */
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { withFixtures, type Fixtures } from "@/test/integration";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

/** Postgres's check_violation. */
const CHECK_VIOLATION = "23514";

async function save(
  fixtures: Fixtures,
  event: Partial<EventInsert>,
  eventId?: string
) {
  const { data, error } = await fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId ?? null!,
    p_event: event,
    p_slug: `page-settings-${fixtures.tag}`,
    p_expected_image_url: null!,
    p_check_in_sessions: [],
    p_application_questions: [],
    p_mentors: [],
    p_sponsors: [],
  });
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (!eventId) fixtures.track("events", id);
  return id;
}

async function readEvent(fixtures: Fixtures, id: string) {
  const { data, error } = await fixtures.supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

describe("event page settings", () => {
  it("gives an event created without them the defaults", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent();
      expect(event).toMatchObject({
        is_featured: false,
        location_type: "in_person",
        agenda_enabled: true,
        header_image_url: null,
        header_colour: null,
        event_colour: null,
        marketing_url: null,
        location_address: null,
      });
    }));

  it("takes a header image or a header colour, never both", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ header_colour: "#325DC4" });

      const { error } = await fixtures.supabase
        .from("events")
        .update({ header_image_url: "https://example.test/header.png" })
        .eq("id", event.id);
      expect(error?.code).toBe(CHECK_VIOLATION);

      const swapped = await fixtures.supabase
        .from("events")
        .update({ header_image_url: "https://example.test/header.png", header_colour: null })
        .eq("id", event.id);
      expect(swapped.error).toBeNull();
    }));

  it.each<Partial<EventInsert>>([
    { header_colour: "blue" },
    { header_colour: "#325DC" },
    { event_colour: "325DC4" },
    { event_colour: "#325DC4FF" },
  ])("rejects %j, which isn't #RRGGBB", (colour) =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent();
      const { error } = await fixtures.supabase
        .from("events")
        .update(colour)
        .eq("id", event.id);
      expect(error?.code).toBe(CHECK_VIOLATION);
    }));

  it("is saved by the builder when sent, and left alone by a save that omits it", () =>
    withFixtures(async (fixtures) => {
      const base = {
        name: `Page settings ${fixtures.tag}`,
        description: "Event page settings integration test.",
        status: "draft" as const,
        regular_price: 10,
        member_price: 5,
        max_capacity: 10,
      };
      const settings = {
        header_colour: "#C77DC4",
        event_colour: "#325DC4",
        is_featured: true,
        marketing_url: "https://devpost.example.test",
        location_address: "6133 University Blvd, Vancouver, BC",
        location_type: "hybrid" as const,
        agenda_enabled: false,
      };

      const id = await save(fixtures, { ...base, ...settings });
      expect(await readEvent(fixtures, id)).toMatchObject(settings);

      // Today's builder sends none of these: a save must not reset them.
      await save(fixtures, { ...base, name: `Renamed ${fixtures.tag}` }, id);
      expect(await readEvent(fixtures, id)).toMatchObject({
        ...settings,
        name: `Renamed ${fixtures.tag}`,
      });
    }));
});

describe("sponsor details", () => {
  it("stores a description and website", () =>
    withFixtures(async (fixtures) => {
      const { data, error } = await fixtures.supabase
        .from("sponsors")
        .insert({
          name: `Sponsor ${fixtures.tag}`,
          description: "Artisanal food sponsor",
          website_url: "https://harvest.example.test",
        })
        .select()
        .single();
      if (error) throw error;
      fixtures.track("sponsors", data.id);
      expect(data).toMatchObject({
        description: "Artisanal food sponsor",
        website_url: "https://harvest.example.test",
      });
    }));
});
