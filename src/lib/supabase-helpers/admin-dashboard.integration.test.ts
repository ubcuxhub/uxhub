import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import {
  fetchActiveMemberCount, fetchConfirmedEventRegistrationCount,
  fetchNextDashboardEvent, fetchUpcomingEventCount, fetchUpcomingRegistrationCount,
} from "./admin-dashboard";

// Far beyond seed events and other suites' fixtures, keeping global counts
// isolated without clearing or changing any existing database rows.
const now = "2200-01-01T00:00:00.000Z";
const future = "2200-02-01T00:00:00.000Z";

describe("admin dashboard database reads", () => {
  it("counts current memberships with individual and term ceilings, excluding deleted accounts", () => withFixtures(async (fixtures) => {
    const db = fixtures.supabase;
    const admin = await fixtures.createUser({ role_access: "admin" });
    const client = clientAs(admin);
    const { data: tier, error } = await db.from("membership_types").insert({ name: fixtures.tag, slug: fixtures.tag, price: 0, description: "Dashboard test tier" }).select("id").single();
    if (error) throw error;
    fixtures.track("membership_types", tier.id);
    const before = await fetchActiveMemberCount(client, now, null);
    for (const patch of [
      { membership_expires_at: future },
      { membership_expires_at: null },
      { membership_expires_at: now },
      { membership_expires_at: "2199-12-31T00:00:00Z" },
      { membership_expires_at: future, deleted_at: now },
    ]) await fixtures.createUser({ membership_type_id: tier.id, ...patch });
    expect(await fetchActiveMemberCount(client, now, null)).toBe(before + 2);
    expect(await fetchActiveMemberCount(client, now, future)).toBe(before + 2);
    expect(await fetchActiveMemberCount(client, now, now)).toBe(0);
    const manager = await fixtures.createUser({ role_access: "manager" });
    expect(await fetchActiveMemberCount(clientAs(manager), now, null)).toBe(before + 2);
  }));

  it("selects published future events and counts confirmed attendance through the event join", () => withFixtures(async (fixtures) => {
    const db = fixtures.supabase;
    const admin = await fixtures.createUser({ role_access: "admin" });
    const client = clientAs(admin);
    const member = await fixtures.createUser();
    const initialEvents = await fetchUpcomingEventCount(client, now);
    const initialRegistrations = await fetchUpcomingRegistrationCount(client, now);
    const events = [];
    const variants: Parameters<typeof fixtures.createEvent>[0][] = [
      { status: "active", starts_at: future },
      { status: "draft", starts_at: future },
      { status: "archived", starts_at: future },
      { status: "active", starts_at: now },
      { status: "active", starts_at: future, publish_at: future },
      { status: "active", starts_at: null },
      { status: "active", starts_at: future, publish_at: now },
    ];
    for (const [index, patch] of variants.entries()) {
      events.push(await fixtures.createEvent({
        slug: `${fixtures.tag}-${index}`, ...patch,
      }));
    }
    const result = await db.from("event_registrations").insert(events.map((event) => ({
      event_id: event.id, user_id: member.id, attending: true,
    })));
    if (result.error) throw result.error;
    const pending = await fixtures.createUser();
    const pendingResult = await db.from("event_registrations").insert({ event_id: events[0].id, user_id: pending.id, attending: false, status: "pending" });
    if (pendingResult.error) throw pendingResult.error;
    expect(await fetchUpcomingEventCount(client, now)).toBe(initialEvents + 2);
    expect(await fetchUpcomingRegistrationCount(client, now)).toBe(initialRegistrations + 2);
    expect(await fetchConfirmedEventRegistrationCount(client, events[0].id)).toBe(1);
    const first = [events[0].id, events[6].id].sort()[0];
    expect((await fetchNextDashboardEvent(client, now))?.id).toBe(first);
    expect(await fetchNextDashboardEvent(client, "2300-01-01T00:00:00Z")).toBeNull();
    expect(await fetchUpcomingEventCount(client, "2300-01-01T00:00:00Z")).toBe(0);
    expect(await fetchUpcomingRegistrationCount(client, "2300-01-01T00:00:00Z")).toBe(0);
  }));
});
