/**
 * Proves the harness itself: that `pnpm test:integration` reaches the local
 * database, that fixtures are visible to the app's own code while a test runs,
 * and that nothing survives the test. Step 2 of the integration plan builds the
 * `reserve_paid_event_ticket` cases on top of this.
 */
import { afterAll, describe, expect, it } from "vitest";

import { fetchEventBySlug } from "@/lib/supabase-helpers/events";

import { createIntegrationClient, Fixtures, withFixtures } from "./integration";

const supabase = createIntegrationClient();

describe("integration harness", () => {
  it("reaches the local database", async () => {
    const { error } = await supabase.from("events").select("id").limit(1);

    expect(error).toBeNull();
  });

  it("gives each fixture set its own tag", async () => {
    const tags = new Set<string>();

    await withFixtures(async (fixtures) => {
      tags.add(fixtures.tag);
    });
    await withFixtures(async (fixtures) => {
      tags.add(fixtures.tag);
    });

    expect(tags.size).toBe(2);
  });

  it("creates an event the app's own helper can read back", async () => {
    await withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });

      // Through the helper rather than a raw query: the point of this suite is
      // running the app's TypeScript against a real database.
      const found = await fetchEventBySlug(supabase, event.slug!);

      expect(found?.id).toBe(event.id);
      expect(found?.name).toContain(fixtures.tag);
    });
  });

  it("creates a user paired with an auth account", async () => {
    await withFixtures(async (fixtures) => {
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

    await withFixtures(async (fixtures) => {
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

  afterAll(async () => {
    // A tagged row surviving the suite means cleanup has a hole in it.
    const { data } = await supabase
      .from("events")
      .select("id")
      .like("slug", "integration-event-it-%");

    expect(data).toEqual([]);
  });
});
