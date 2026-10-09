/**
 * Proves the harness itself: that `pnpm test:integration` reaches the local
 * database, that fixtures are visible to the app's own code while a test runs,
 * and that nothing survives the test. Step 1 of the integration plan builds the
 * `reserve_paid_event_ticket` cases on top of this.
 */
import { afterAll, describe, expect, it } from "vitest";

import { fetchEventBySlug } from "@/lib/supabase-helpers/events";

import { createIntegrationClient, Fixtures, withFixtures } from "./integration";

const supabase = createIntegrationClient();

// Every tag this file hands out, so the leak check below looks only at its own
// rows. Test files run in parallel, so another file's fixtures may still exist.
const tags: string[] = [];

function withTaggedFixtures<T>(fn: (fixtures: Fixtures) => Promise<T>) {
  return withFixtures((fixtures) => {
    tags.push(fixtures.tag);
    return fn(fixtures);
  });
}

describe("integration harness", () => {
  it("reaches the local database", async () => {
    const { error } = await supabase.from("events").select("id").limit(1);

    expect(error).toBeNull();
  });

  it("gives each fixture set its own tag", async () => {
    const tags = new Set<string>();

    await withTaggedFixtures(async (fixtures) => {
      tags.add(fixtures.tag);
    });
    await withTaggedFixtures(async (fixtures) => {
      tags.add(fixtures.tag);
    });

    expect(tags.size).toBe(2);
  });

  it("creates an event the app's own helper can read back", async () => {
    await withTaggedFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });

      // Through the helper rather than a raw query: the point of this suite is
      // running the app's TypeScript against a real database.
      const found = await fetchEventBySlug(supabase, event.slug!);

      expect(found?.id).toBe(event.id);
      expect(found?.name).toContain(fixtures.tag);
    });
  });

  it("creates a user paired with an auth account", async () => {
    await withTaggedFixtures(async (fixtures) => {
      const user = await fixtures.createUser();

      expect(user.auth_user_id).toBeTruthy();

      const { data } = await supabase.auth.admin.getUserById(
        user.auth_user_id!,
      );
      expect(data.user?.email).toBe(user.email);
    });
  });

  it("removes every fixture once the test finishes", async () => {
    let eventId = "";
    let userId = "";
    let authUserId = "";

    await withTaggedFixtures(async (fixtures) => {
      eventId = (await fixtures.createEvent()).id;
      const user = await fixtures.createUser();
      userId = user.id;
      authUserId = user.auth_user_id!;
    });

    // Nothing may leak into the next run, or the suite stops being repeatable
    // on the seeded local database.
    const [events, users, authUser] = await Promise.all([
      supabase.from("events").select("id").eq("id", eventId),
      supabase.from("user_info").select("id").eq("id", userId),
      supabase.auth.admin.getUserById(authUserId),
    ]);

    expect(events.data).toEqual([]);
    expect(users.data).toEqual([]);
    expect(authUser.data.user).toBeNull();
  });

  it("clears up even when the test body throws", async () => {
    const fixtures = new Fixtures(supabase);
    tags.push(fixtures.tag);
    let eventId = "";

    await expect(
      (async () => {
        try {
          eventId = (await fixtures.createEvent()).id;
          throw new Error("boom");
        } finally {
          await fixtures.cleanup();
        }
      })(),
    ).rejects.toThrow("boom");

    const { data } = await supabase.from("events").select("id").eq("id", eventId);
    expect(data).toEqual([]);
  });

  it("removes the purchase and registration a ticket leaves behind", async () => {
    let eventId = "";
    let userId = "";

    // The user is created first on purpose. Deleting newest first would then
    // try the event before the user, and the purchase restricts that, while
    // the registration blocks deleting the user. Neither row is tracked, as
    // neither is when the app or `reserve_paid_event_ticket` writes it.
    await withTaggedFixtures(async (fixtures) => {
      const user = await fixtures.createUser();
      const event = await fixtures.createEvent({ status: "active" });
      userId = user.id;
      eventId = event.id;

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          user_id: user.id,
          event_id: event.id,
          kind: "event_ticket",
          status: "completed",
          amount_cents: 1000,
          currency: "CAD",
          idempotency_key: `${fixtures.tag}-ticket`,
        })
        .select("id")
        .single();
      expect(purchaseError).toBeNull();

      const { error: registrationError } = await supabase
        .from("event_registrations")
        .insert({
          user_id: user.id,
          event_id: event.id,
          purchase_id: purchase!.id,
        });
      expect(registrationError).toBeNull();
    });

    const [events, users, purchases, registrations] = await Promise.all([
      supabase.from("events").select("id").eq("id", eventId),
      supabase.from("user_info").select("id").eq("id", userId),
      supabase.from("purchases").select("id").eq("event_id", eventId),
      supabase.from("event_registrations").select("id").eq("event_id", eventId),
    ]);

    expect(events.data).toEqual([]);
    expect(users.data).toEqual([]);
    expect(purchases.data).toEqual([]);
    expect(registrations.data).toEqual([]);
  });

  afterAll(async () => {
    // A row this file tagged surviving the suite means cleanup has a hole in
    // it. Scoped to this file's tags: other files may still hold fixtures.
    const { data } = await supabase
      .from("events")
      .select("id")
      .in(
        "slug",
        tags.map((tag) => `integration-event-${tag}`),
      );

    expect(data).toEqual([]);
  });
});
