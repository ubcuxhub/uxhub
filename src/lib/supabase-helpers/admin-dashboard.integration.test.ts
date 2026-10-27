import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchMembershipAnalytics, fetchEventAnalytics, fetchNextDashboardEvent } from "./admin-dashboard";

const now = "2200-10-01T12:00:00.000Z";
const future = "2200-11-01T12:00:00.000Z";

function check(error: unknown) { if (error) throw error; }

describe("admin dashboard analytics", () => {
  it("groups active members, applies expiry/term ceilings, and counts distinct fulfilled buyers", () => withFixtures(async (fixtures) => {
    const db = fixtures.supabase;
    const admin = await fixtures.createUser({ role_access: "admin" });
    const client = clientAs(admin);
    const settings = await db.from("app_settings").select("membership_term_ends_at").single();
    check(settings.error);
    try {
      check((await db.from("app_settings").update({ membership_term_ends_at: future }).eq("id", true)).error);
      const tierResult = await db.from("membership_types").insert([
        { name: fixtures.tag, slug: fixtures.tag, price: 0, description: "Test", active: false },
        { name: `${fixtures.tag}-empty`, slug: `${fixtures.tag}-empty`, price: 0, description: "Test", active: true },
      ]).select("id, slug");
      check(tierResult.error);
      const tiers = tierResult.data!;
      tiers.forEach((tier) => fixtures.track("membership_types", tier.id));
      const tierId = tiers.find((tier) => tier.slug === fixtures.tag)!.id;
      const baseline = await fetchMembershipAnalytics(client, now);
      const users = [];
      for (const patch of [
        { membership_expires_at: future }, { membership_expires_at: null },
        { membership_expires_at: now }, { membership_expires_at: future, deleted_at: now },
      ]) users.push(await fixtures.createUser({ membership_type_id: tierId, ...patch }));
      const lower = new Date(new Date(now).getTime() - 30 * 86400000).toISOString();
      const purchases = [
        { user_id: users[0].id, fulfilled_at: lower },
        { user_id: users[0].id, fulfilled_at: now }, // Repeat buyer, not another person.
        { user_id: users[3].id, fulfilled_at: now }, // Deleted accounts retain history.
        { user_id: users[1].id, fulfilled_at: new Date(new Date(lower).getTime() - 1).toISOString() },
        { user_id: users[1].id, fulfilled_at: future },
        { user_id: users[1].id, fulfilled_at: null },
        { user_id: users[1].id, fulfilled_at: now, status: "failed" },
        { user_id: users[1].id, fulfilled_at: now, status: "pending" },
      ];
      check((await db.from("purchases").insert(purchases.map((purchase) => ({
        kind: "membership", status: "completed", amount_cents: 0, currency: "CAD",
        membership_type_id: tierId, idempotency_key: randomUUID(), ...purchase,
      })))).error);
      const result = await fetchMembershipAnalytics(client, now);
      expect(result.activeMembers).toBe(baseline.activeMembers + 2);
      expect(result.buyersLast30Days).toBe(baseline.buyersLast30Days + 2);
      expect(result.tiers.find((tier) => tier.id === tierId)?.count).toBe(2);
      expect(result.tiers.find((tier) => tier.id !== tierId && tiers.some((t) => t.id === tier.id))?.count).toBe(0);
      check((await db.from("app_settings").update({ membership_term_ends_at: now }).eq("id", true)).error);
      expect((await fetchMembershipAnalytics(client, now)).activeMembers).toBe(0);
      check((await db.from("app_settings").update({ membership_term_ends_at: null }).eq("id", true)).error);
      expect((await fetchMembershipAnalytics(client, now)).activeMembers).toBe(baseline.activeMembers + 2);
    } finally {
      check((await db.from("app_settings").update({ membership_term_ends_at: settings.data!.membership_term_ends_at }).eq("id", true)).error);
    }
  }));

  it("orders published events, counts confirmed registrations and deduplicates attendance", () => withFixtures(async (fixtures) => {
    const db = fixtures.supabase;
    const admin = await fixtures.createUser({ role_access: "admin" });
    const manager = await fixtures.createUser({ role_access: "manager" });
    const people = [await fixtures.createUser(), await fixtures.createUser(), await fixtures.createUser()];
    const variants: Parameters<typeof fixtures.createEvent>[0][] = [
      { status: "active", starts_at: "2200-09-01T07:00:00Z" }, // Inclusive Vancouver boundary.
      { status: "active", starts_at: future, start_date: "2200-11-01", location_building: "AMS Nest", location_room: "101", location_address_url: "https://maps.google.com/?q=AMS+Nest", regular_price: 12, member_price: 5 },
      { status: "active", starts_at: "2201-05-01T07:00:00Z" }, // Exclusive end boundary.
      { status: "draft", starts_at: future },
      { status: "archived", starts_at: future },
      { status: "active", starts_at: future, publish_at: future },
      { status: "active", starts_at: null },
      { status: "active", starts_at: "2200-09-01T06:59:59Z" },
      { status: "active", starts_at: "2201-04-30T23:00:00Z" }, // Zero registrations.
    ];
    const events: Awaited<ReturnType<typeof fixtures.createEvent>>[] = [];
    for (const [i, variant] of variants.entries()) events.push(await fixtures.createEvent({ slug: `${fixtures.tag}-${i}`, ...variant }));
    for (const [i, event] of events.entries()) {
      const person = i === 0 || i === 1 ? people[0] : people[2];
      const registration = await db.from("event_registrations").insert({ event_id: event.id, user_id: person.id, attending: true }).select("id").single();
      check(registration.error);
      if (i === 8) { check((await db.from("event_registrations").delete().eq("id", registration.data!.id)).error); continue; }
      const sessions = await db.from("check_in_sessions").insert([0, 1].map((n) => ({ event_id: event.id, name: `Session ${n}`, start_time: now, end_time: future }))).select("id");
      check(sessions.error);
      check((await db.from("check_ins").insert(sessions.data!.map((session) => ({ event_registration_id: registration.data!.id, check_in_session_id: session.id, checked_in_at: now })))).error);
      if (i === 1) {
        const second = await db.from("event_registrations").insert({ event_id: event.id, user_id: people[1].id, attending: true }).select("id").single();
        check(second.error);
        check((await db.from("check_ins").insert({ event_registration_id: second.data!.id, check_in_session_id: sessions.data![0].id, checked_in_at: now })).error);
      }
    }
    // Pending registration and a cleared check-in do not inflate either count.
    const pending = await fixtures.createUser();
    check((await db.from("event_registrations").insert({ event_id: events[0].id, user_id: pending.id, attending: false })).error);
    const result = await fetchEventAnalytics(clientAs(admin), now);
    expect(result.events.filter((event) => events.some((fixture) => fixture.id === event.id)).map((event) => event.id)).toEqual([events[7].id, events[0].id, events[1].id, events[8].id, events[2].id]);
    expect(result.events.find((event) => event.id === events[1].id)).toMatchObject({ registrations: 2, attendees: 2 });
    expect(result.events.find((event) => event.id === events[8].id)).toMatchObject({ registrations: 0, attendees: 0 });
    expect(result.currentEvent?.id).toBe(events[1].id);
    expect(await fetchNextDashboardEvent(clientAs(admin), now)).toMatchObject({
      id: result.currentEvent?.id, start_date: "2200-11-01", location_building: "AMS Nest",
      location_room: "101", location_address_url: "https://maps.google.com/?q=AMS+Nest", regular_price: 12, member_price: 5,
    });
    expect(result.uniqueParticipants).toBe(2);
    expect(result.schoolYearLabel).toBe("2200–2201");
    expect(await fetchEventAnalytics(clientAs(manager), now)).toEqual(result);
    expect((await fetchEventAnalytics(clientAs(admin), "2201-07-01T00:00:00Z")).schoolYearLabel).toBe("2200–2201");
    expect((await fetchEventAnalytics(clientAs(admin), "2201-09-01T07:00:00Z")).schoolYearLabel).toBe("2201–2202");
  }));

  it("denies analytics to ordinary members and anonymous callers", () => withFixtures(async (fixtures) => {
    const member = await fixtures.createUser();
    for (const client of [clientAs(member), clientAs(null)]) {
      await expect(fetchMembershipAnalytics(client, now)).rejects.toMatchObject({ code: "42501" });
      await expect(fetchEventAnalytics(client, now)).rejects.toMatchObject({ code: "42501" });
    }
  }));
});
