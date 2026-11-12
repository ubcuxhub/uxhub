import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedUsers } from "../data/users.ts";
import { buildSeedCrowd } from "../data/crowd.ts";
import { membershipTypes } from "../data/membership-types.ts";
import { validateUserFixtures } from "./user-fixtures.ts";
import { seedDateLocation } from "./builder-settings.ts";
import { dateSessions, dateLocationProblem } from "../../../src/features/admin/lib/event-date-location";
import { prepareLegacySeedPricing, validateSeedEvents } from "./event-model.ts";

const now = new Date("2026-11-11T20:00:00Z");
const events = buildSeedEvents(now);
const users = [...buildSeedUsers(events, now), ...buildSeedCrowd(events, now)];

describe("delivered event seed model", () => {
  it.each(["2026-01-01T20:00:00Z", "2026-07-31T19:00:00Z", "2026-11-11T20:00:00Z"])("validates content, operational pricing and dependent fixtures at %s", value => {
    const clock = new Date(value);
    const fixtures = buildSeedEvents(clock);
    expect(() => validateSeedEvents(fixtures)).not.toThrow();
    expect(() => validateUserFixtures([...buildSeedUsers(fixtures, clock), ...buildSeedCrowd(fixtures, clock)], fixtures, membershipTypes, clock)).not.toThrow();
  });

  it("provides valid public/Going, multiple-date and per-date editor fixtures", () => {
    const saved = events.map(seedDateLocation).filter(value => value !== null);
    for (const seed of events) {
      const settings = seedDateLocation(seed);
      if (!settings) continue;
      expect(dateLocationProblem(settings)).toBeNull();
      const sessions = dateSessions(settings);
      expect(Math.min(...sessions.map(session => Date.parse(session.start_time)))).toBe(Date.parse(seed.event.starts_at!));
      expect(Math.max(...sessions.map(session => Date.parse(session.end_time)))).toBe(Date.parse(seed.event.ends_at!));
      expect(sessions.map(session => session.name)).toEqual(seed.checkInSessions.map(session => session.name));
    }
    expect(saved.some(settings => settings.audience === "going" && settings.dates.some(date => date.location))).toBe(true);
    expect(saved.some(settings => settings.dates.length > 1)).toBe(true);
    expect(saved.some(settings => settings.location.type === "online")).toBe(true);
  });

  it.each([
    { short_description: "x".repeat(51) }, { description: " " }, { description: "x".repeat(3001) },
    { configured_price: null },
    { member_price: 5 }, { pricing_policy: "legacy" }, { configured_price: 1.001 },
    { configured_marketing_mode: "external", configured_marketing_url: "javascript:alert(1)" },
    { registration_closes_at: "invalid" },
  ])("rejects invalid fixture settings before writes: %j", change => {
    const fixtures = structuredClone(events);
    Object.assign(fixtures[0].event, change);
    expect(() => validateSeedEvents(fixtures)).toThrow();
  });

  it("keeps free purchase receipts charge-free, including active members at paid events", () => {
    const free = users.flatMap(user => user.purchases.filter(purchase => purchase.kind === "event_ticket" && purchase.amountCents === 0));
    expect(free.length).toBeGreaterThan(0);
    expect(free.every(purchase => !purchase.squarePaymentId)).toBe(true);
    const member = users.find(user => user.email === "student-innovator@example.com")!;
    expect(member.purchases.find(purchase => purchase.eventSlug === "mentorship-program")?.amountCents).toBe(0);
  });
});

function conversionClient(outsider = false) {
  const writes: string[] = [];
  const from = vi.fn((table: string) => {
    let operation = "read";
    let excludeFixtures = false;
    const result = () => ({ data: operation !== "read" ? [] : table === "events" ? [{ id: "event", slug: events[0].event.slug, pricing_policy: "legacy" }] :
      table === "user_info" ? [{ id: "fixture", email: users[0].email, auth_user_id: "auth" }] :
      (excludeFixtures && !outsider ? [] : [{ user_id: outsider ? "handmade" : "fixture" }]), error: null });
    const query = {
      select: () => query, in: () => query, eq: () => query, limit: () => query,
      not: () => { excludeFixtures = true; return query; },
      update: () => { operation = "update"; writes.push(table); return query; },
      delete: () => { operation = "delete"; writes.push(table); return query; },
      then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, writes };
}

const options = { target: "local", users: true, prune: true, dryRun: false };
describe("legacy fixture pricing conversion", () => {
  it("refuses handmade records before any writes", async () => {
    const { client, writes } = conversionClient(true);
    await expect(prepareLegacySeedPricing(client, events, users, options)).rejects.toThrow("non-fixture");
    expect(writes).toEqual([]);
  });
  it.each([{ ...options, target: "prod" }, { ...options, prune: false }, { ...options, users: false }])("refuses destructive conversion with %j", async policy => {
    const { client, writes } = conversionClient();
    await expect(prepareLegacySeedPricing(client, events, users, policy)).rejects.toThrow("full local seed");
    expect(writes).toEqual([]);
  });
  it("previews conversion without modifying locks or registrations", async () => {
    const { client, writes } = conversionClient();
    expect(await prepareLegacySeedPricing(client, events, users, { ...options, dryRun: true })).toBe(1);
    expect(writes).toEqual([]);
  });
});
