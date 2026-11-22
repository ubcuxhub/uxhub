import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchMajorDistribution, fetchMembershipHistory, fetchNextDashboardEvent, fetchConfirmedEventRegistrationCount } from "./admin-dashboard";

const now = "2200-10-01T12:00:00.000Z";
const future = "2200-11-01T12:00:00.000Z";

function check(error: unknown) { if (error) throw error; }

describe("admin dashboard data", () => {
  it("returns confirmed ticket counts including real zero for admin and manager", () => withFixtures(async (fixtures) => {
    const admin = await fixtures.createUser({ role_access: "admin" });
    const manager = await fixtures.createUser({ role_access: "manager" });
    const attendee = await fixtures.createUser();
    const event = await fixtures.createEvent({ status: "active", starts_at: now, ends_at: future, location_building: "AMS Nest", regular_price: 12, member_price: 5 });
    for (const user of [admin, manager]) {
      const db = clientAs(user);
      expect(await fetchConfirmedEventRegistrationCount(db, event.id)).toBe(0);
      expect(await fetchNextDashboardEvent(db, now)).toMatchObject({ id: event.id, location_building: "AMS Nest", regular_price: 12, member_price: 5 });
    }
    check((await fixtures.supabase.from("event_tickets").insert({ event_id: event.id, user_id: attendee.id })).error);
    for (const user of [admin, manager]) expect(await fetchConfirmedEventRegistrationCount(clientAs(user), event.id)).toBe(1);
  }));

  it("keeps ongoing events until their end and advances the preview at the boundary", () => withFixtures(async (fixtures) => {
    const admin = await fixtures.createUser({ role_access: "admin" });
    const manager = await fixtures.createUser({ role_access: "manager" });
    const start = "2300-10-01T12:00:00Z";
    const end = "2300-10-01T14:00:00Z";
    const overlapping = "2300-10-01T13:00:00Z";
    const overlapEnd = "2300-10-01T15:00:00Z";
    const nextStart = "2300-10-02T12:00:00Z";
    const nextEnd = "2300-10-02T14:00:00Z";
    const events = [];
    for (const [i, variant] of [
      { starts_at: start, ends_at: end },
      { starts_at: overlapping, ends_at: overlapEnd },
      { starts_at: nextStart, ends_at: nextEnd },
    ].entries()) {
      events.push(await fixtures.createEvent({ slug: `${fixtures.tag}-${i}`, status: "active", ...variant }));
    }
    const cases = [
      ["2300-10-01T11:59:59Z", events[0].id],
      [start, events[0].id],
      [overlapping, events[0].id],
      ["2300-10-01T13:59:59Z", events[0].id],
      [end, events[1].id],
      ["2300-10-01T14:30:00Z", events[1].id],
      [overlapEnd, events[2].id],
      ["2300-10-02T11:59:59Z", events[2].id],
      [nextStart, events[2].id],
      ["2300-10-02T13:00:00Z", events[2].id],
      [nextEnd, null],
      ["2300-10-02T15:00:00Z", null],
    ] as const;
    for (const user of [admin, manager]) {
      const client = clientAs(user);
      for (const [at, expectedId] of cases) {
        expect((await fetchNextDashboardEvent(client, at))?.id ?? null).toBe(expectedId);
      }
    }
  }));

  it("uses deterministic ordering and excludes ineligible ongoing events", () => withFixtures(async (fixtures) => {
    const admin = await fixtures.createUser({ role_access: "admin" });
    const client = clientAs(admin);
    const at = "2300-10-01T13:00:00Z";
    const starts_at = "2300-10-01T12:00:00Z";
    const ends_at = "2300-10-01T14:00:00Z";
    const ids: string[] = [];
    const variants = [
      { status: "active", publish_at: null },
      { status: "active", publish_at: null },
      { status: "draft" },
      { status: "draft", publish_at: at },
      { status: "draft", publish_at: ends_at },
      { status: "draft", starts_at: null, ends_at: null },
    ] satisfies Parameters<typeof fixtures.createEvent>[0][];
    for (const [i, variant] of variants.entries()) {
      const event = await fixtures.createEvent({ slug: `${fixtures.tag}-${i}`, starts_at, ends_at, ...variant });
      if (i < 2) ids.push(event.id);
    }
    ids.sort();
    expect((await fetchNextDashboardEvent(client, at))?.id).toBe(ids[0]);
    for (const id of ids) {
      check((await fixtures.supabase.from("events").update({ status: "draft" }).eq("id", id)).error);
    }
    expect(await fetchNextDashboardEvent(client, at)).toBeNull();
  }));

  it("denies analytics to ordinary members and anonymous callers", () => withFixtures(async (fixtures) => {
    const member = await fixtures.createUser();
    for (const client of [clientAs(member), clientAs(null)]) {
      await expect(fetchMembershipHistory(client, now)).rejects.toMatchObject({ code: "42501" });
      await expect(fetchMajorDistribution(client)).rejects.toMatchObject({ code: "42501" });
    }
  }));
});
