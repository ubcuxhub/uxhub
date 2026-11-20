/**
 * Agenda item links (20261119073211) against the local database: a link names
 * at most one agenda item of its own event and goes when the item does,
 * builder resource saves keep it, and the participant agenda says which days
 * set their own location.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { emptyContent, type EventContent } from "@/features/admin/lib/event-content";

import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import type { Json } from "@/lib/supabase/database.types";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

const db = createIntegrationClient();

/** Postgres's unique_violation and check_violation. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const date = tomorrow.toISOString().slice(0, 10);

/** An active event with one agenda day holding one item. */
async function eventWithItem(fixtures: Fixtures) {
  const event = await fixtures.createEvent({ status: "active", starts_at: tomorrow.toISOString() });
  const day = await db.from("event_agenda_days").insert({ event_id: event.id, date, title: "Kickoff" }).select("id").single();
  if (day.error) throw day.error;
  const item = await db
    .from("event_agenda_items")
    .insert({ event_agenda_day_id: day.data.id, title: "Final presentations", start_time: "10:00", end_time: "12:00" })
    .select("id")
    .single();
  if (item.error) throw item.error;
  return { event, dayId: day.data.id, itemId: item.data.id };
}

function insertLink(eventId: string, agendaItemId: string | null, url = "https://slides.example.test") {
  return db
    .from("event_links")
    .insert({ event_id: eventId, type: "other", label: "Slides", url, agenda_item_id: agendaItemId })
    .select("id")
    .single();
}

describe("event_links.agenda_item_id", () => {
  it("links an agenda item, readable through the viewer's own client", () =>
    withFixtures(async (fixtures) => {
      const { event, itemId } = await eventWithItem(fixtures);
      const { error } = await insertLink(event.id, itemId);
      expect(error).toBeNull();

      const links = await fetchEventLinks(clientAs(null), event.id);
      expect(links.map((link) => link.agenda_item_id)).toEqual([itemId]);
    }));

  it("allows at most one link per agenda item", () =>
    withFixtures(async (fixtures) => {
      const { event, itemId } = await eventWithItem(fixtures);
      await insertLink(event.id, itemId);
      const { error } = await insertLink(event.id, itemId, "https://other.example.test");
      expect(error?.code).toBe(UNIQUE_VIOLATION);
    }));

  it("refuses an agenda item from another event", () =>
    withFixtures(async (fixtures) => {
      const { itemId } = await eventWithItem(fixtures);
      const other = await fixtures.createEvent({ status: "active", slug: `other-${fixtures.tag}` });
      const { error } = await insertLink(other.id, itemId);
      expect(error?.code).toBe(CHECK_VIOLATION);
    }));

  it("deletes the link with its agenda item", () =>
    withFixtures(async (fixtures) => {
      const { event, itemId } = await eventWithItem(fixtures);
      const link = await insertLink(event.id, itemId);
      if (link.error) throw link.error;

      const { error } = await db.from("event_agenda_items").delete().eq("id", itemId);
      if (error) throw error;

      const { count } = await db.from("event_links").select("*", { count: "exact", head: true }).eq("id", link.data.id);
      expect(count).toBe(0);
    }));
});

/** The builder's view of a link: it never sends agenda_item_id. */
function builderLink(id: string, url = "https://slides.example.test") {
  return { id, type: "other" as const, label: "Slides", url, visibility: "everyone" as const };
}

async function agendaItemOf(linkId: string) {
  const { data, error } = await db.from("event_links").select("agenda_item_id").eq("id", linkId).single();
  if (error) throw error;
  return data.agenda_item_id;
}

describe("resource saves", () => {
  it("keep a link's agenda item through a builder save", () =>
    withFixtures(async (fixtures) => {
      const { event, itemId } = await eventWithItem(fixtures);
      const link = await insertLink(event.id, itemId);
      if (link.error) throw link.error;

      const content: EventContent = { ...emptyContent(), links: [builderLink(link.data.id, "https://slides.example.test/v2")] };
      const { error } = await db.rpc("save_admin_event_atomically", {
        p_event_id: event.id, p_event: { _content: content } as unknown as Json, p_slug: null!, p_expected_image_url: null!,
        p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
      });
      expect(error).toBeNull();
      expect(await agendaItemOf(link.data.id)).toBe(itemId);
    }));

  it("keep a link's agenda item through a past-event resources save", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active", starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-01-02T00:00:00Z" });
      const day = await db.from("event_agenda_days").insert({ event_id: event.id, date: "2020-01-01", title: "Kickoff" }).select("id").single();
      if (day.error) throw day.error;
      const item = await db.from("event_agenda_items").insert({ event_agenda_day_id: day.data.id, title: "Final presentations", start_time: "10:00", end_time: "12:00" }).select("id").single();
      if (item.error) throw item.error;
      const link = await insertLink(event.id, item.data.id);
      if (link.error) throw link.error;
      const unlinked = randomUUID();

      const { data: current } = await db.from("events").select("revision").eq("id", event.id).single();
      const { error } = await db.rpc("save_past_event_resources", {
        p_event_id: event.id, p_revision: current!.revision, p_operation_id: fixtures.track("admin_event_mutations", randomUUID()),
        p_links: [builderLink(link.data.id), builderLink(unlinked, "https://recording.example.test")] as unknown as Json,
      });
      expect(error).toBeNull();
      expect(await agendaItemOf(link.data.id)).toBe(item.data.id);
      expect(await agendaItemOf(unlinked)).toBeNull();
    }));
});

describe("event_participant_content", () => {
  it("says whether each day set its own location", () =>
    withFixtures(async (fixtures) => {
      const { event, dayId } = await eventWithItem(fixtures);
      const second = await db.from("event_agenda_days").insert({ event_id: event.id, date: "2099-12-31", title: "Finals" }).select("id").single();
      if (second.error) throw second.error;
      const venue = { type: "in_person", building: "UBC Robson Square", room: "C300", address: "", map_url: "", public_summary: "Downtown" };
      const { error } = await db.from("event_date_location_settings").upsert({
        event_id: event.id,
        document: {
          location: { ...venue, building: "AMS Nest" },
          dates: [{ key: dayId, date, location: null }, { key: second.data.id, date: "2099-12-31", location: venue }],
        },
      });
      if (error) throw error;

      const content = await fetchEventParticipantContent(clientAs(null), event.id);
      expect(content.agenda.map((day) => [day.title, day.location_overridden])).toEqual([["Kickoff", false], ["Finals", true]]);
    }));
});
