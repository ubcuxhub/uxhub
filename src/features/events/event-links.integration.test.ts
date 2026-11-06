/**
 * Event links and private meeting details against the local database, read
 * with each viewer's own client the way the event page reads them: RLS gives
 * each viewer only what their visibility allows.
 */
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { fetchEventLinks, fetchEventPrivateDetails } from "@/lib/supabase-helpers/event-links";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

const db = createIntegrationClient();

type EventInsert = Partial<Database["public"]["Tables"]["events"]["Insert"]>;

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

/** An active event with one link per visibility, in that order, and meeting details. */
async function eventWithLinks(fixtures: Fixtures, overrides: EventInsert = {}) {
  const event = await fixtures.createEvent({
    status: "active",
    location_type: "online",
    starts_at: at(24 * hour),
    ends_at: at(26 * hour),
    ...overrides,
  });
  const { error } = await db.from("event_links").insert([
    { event_id: event.id, type: "slack_workspace", url: "https://slack.example.test", visibility: "everyone", sort_order: 0 },
    { event_id: event.id, type: "participant_package", url: "https://package.example.test", visibility: "going", sort_order: 1 },
    { event_id: event.id, type: "event_recap", url: "https://recap.example.test", visibility: "after_event", sort_order: 2 },
  ]);
  if (error) throw error;
  const details = await db.from("event_private_details").insert({
    event_id: event.id,
    meeting_url: "https://zoom.example.test/j/123",
    meeting_id: "123 456 789",
    meeting_passcode: "uxhub",
  });
  if (details.error) throw details.error;
  return event;
}

async function withTicket(fixtures: Fixtures, eventId: string) {
  const user = await fixtures.createUser();
  const { error } = await db.from("event_tickets").insert({ event_id: eventId, user_id: user.id });
  if (error) throw error;
  return user;
}

const typesOf = (links: { type: string }[]) => links.map((link) => link.type);

describe("fetchEventLinks", () => {
  it("shows a visitor and a student without a ticket only the everyone links", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures);
      const student = await fixtures.createUser();

      expect(typesOf(await fetchEventLinks(clientAs(null), event.id))).toEqual(["slack_workspace"]);
      expect(typesOf(await fetchEventLinks(clientAs(student), event.id))).toEqual(["slack_workspace"]);
    }));

  it("adds the going links for a ticket holder, in order", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures);
      const holder = await withTicket(fixtures, event.id);

      expect(typesOf(await fetchEventLinks(clientAs(holder), event.id))).toEqual([
        "slack_workspace",
        "participant_package",
      ]);
    }));

  it("adds the after-event links once the event has ended", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures, {
        starts_at: at(-26 * hour),
        ends_at: at(-24 * hour),
      });

      expect(typesOf(await fetchEventLinks(clientAs(null), event.id))).toEqual([
        "slack_workspace",
        "event_recap",
      ]);
    }));

  it("shows admins every link", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures);
      const admin = await fixtures.createUser({ role_access: "admin" });

      expect(typesOf(await fetchEventLinks(clientAs(admin), event.id))).toEqual([
        "slack_workspace",
        "participant_package",
        "event_recap",
      ]);
    }));

  it("hides a draft event's links from everyone but admins", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures, { status: "draft" });
      expect(await fetchEventLinks(clientAs(null), event.id)).toEqual([]);
    }));
});

describe("event_links", () => {
  it("needs a label on an Other link, and a non-blank URL", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent();

      const unlabelled = await db
        .from("event_links")
        .insert({ event_id: event.id, type: "other", url: "https://devpost.example.test" });
      expect(unlabelled.error?.code).toBe("23514");

      const blankUrl = await db
        .from("event_links")
        .insert({ event_id: event.id, type: "slack_workspace", url: "  " });
      expect(blankUrl.error?.code).toBe("23514");

      const labelled = await db
        .from("event_links")
        .insert({ event_id: event.id, type: "other", label: "Devpost", url: "https://devpost.example.test" })
        .select("visibility")
        .single();
      expect(labelled.data).toEqual({ visibility: "everyone" });
    }));
});

describe("fetchEventPrivateDetails", () => {
  it("gives the meeting details to ticket holders and admins only", () =>
    withFixtures(async (fixtures) => {
      const event = await eventWithLinks(fixtures);
      const holder = await withTicket(fixtures, event.id);
      const student = await fixtures.createUser();
      const admin = await fixtures.createUser({ role_access: "admin" });

      const details = {
        event_id: event.id,
        meeting_url: "https://zoom.example.test/j/123",
        meeting_id: "123 456 789",
        meeting_passcode: "uxhub",
      };
      expect(await fetchEventPrivateDetails(clientAs(holder), event.id)).toMatchObject(details);
      expect(await fetchEventPrivateDetails(clientAs(admin), event.id)).toMatchObject(details);
      expect(await fetchEventPrivateDetails(clientAs(student), event.id)).toBeNull();

      // Visitors who aren't signed in can't read the table at all.
      const { error } = await clientAs(null)
        .from("event_private_details")
        .select("*")
        .eq("event_id", event.id);
      expect(error).not.toBeNull();
    }));
});
