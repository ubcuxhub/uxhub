import { describe, expect, it } from "vitest";

import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";

const hour = 60 * 60 * 1000;

async function apply(
  fixtures: Fixtures,
  eventId: string,
  status: "submitted" | "accepted" | "rejected" | "waitlisted"
) {
  const user = await fixtures.createUser();
  const { data, error } = await fixtures.supabase
    .from("event_applications")
    .insert({
      event_id: eventId,
      user_id: user.id,
      status,
      offer_expires_at: status === "accepted" ? new Date(Date.now() + 24 * hour).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  fixtures.track("event_applications", data.id);
}

describe("fetchEventApplicationStatusCounts", () => {
  it("counts one event's applications by status, zeros included", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const other = await fixtures.createEvent({
        slug: `other-${fixtures.tag}`,
        requires_application: true,
      });
      await apply(fixtures, event.id, "submitted");
      await apply(fixtures, event.id, "submitted");
      await apply(fixtures, event.id, "waitlisted");
      await apply(fixtures, other.id, "submitted");

      const expected = { submitted: 2, accepted: 0, rejected: 0, waitlisted: 1, total: 3 };
      expect(await fetchEventApplicationStatusCounts(fixtures.supabase, event.id)).toEqual(expected);

      // The overview reads through the admin's own session, which RLS lets
      // see every application; a member sees none of anyone else's.
      const admin = await fixtures.createUser({ role_access: "admin" });
      expect(await fetchEventApplicationStatusCounts(clientAs(admin), event.id)).toEqual(expected);
      const member = await fixtures.createUser();
      expect((await fetchEventApplicationStatusCounts(clientAs(member), event.id)).total).toBe(0);
    }));

  it("is all zeros for an event without applications", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent();
      expect(await fetchEventApplicationStatusCounts(fixtures.supabase, event.id)).toEqual({
        submitted: 0,
        accepted: 0,
        rejected: 0,
        waitlisted: 0,
        total: 0,
      });
    }));
});
