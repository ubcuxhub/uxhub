import { describe, expect, it } from "vitest";

import { fetchEventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { fetchEventById, updateEventSchedule } from "@/lib/supabase-helpers/events";
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

function schedule() {
  return {
    starts_at: new Date(Date.now() + 48 * hour).toISOString(),
    ends_at: new Date(Date.now() + 50 * hour).toISOString(),
    registration_opens_at: null,
    registration_closes_at: new Date(Date.now() + 47 * hour).toISOString(),
  };
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

describe("updateEventSchedule (the overview's quick edit)", () => {
  it("writes an admin's change through their own session and returns the row", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "draft" });
      const admin = await fixtures.createUser({ role_access: "admin" });
      const dates = schedule();
      const publishAt = new Date(Date.now() + 24 * hour).toISOString();

      const scheduled = await updateEventSchedule(clientAs(admin), event.id, {
        status: "draft",
        publish_at: publishAt,
        ...dates,
      });
      expect(scheduled).toMatchObject({ id: event.id, status: "draft" });
      expect(new Date(scheduled!.publish_at!).toISOString()).toBe(publishAt);
      expect(new Date(scheduled!.starts_at!).toISOString()).toBe(dates.starts_at);

      // Publishing by hand cancels the schedule, through the session too.
      const published = await updateEventSchedule(clientAs(admin), event.id, {
        status: "active",
        publish_at: null,
        ...dates,
      });
      expect(published).toMatchObject({ status: "active", publish_at: null });
      expect(await fetchEventById(clientAs(null), event.id)).not.toBeNull();
    }));

  it("writes nothing for a member or, under the current policy, a manager", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "draft" });
      const member = await fixtures.createUser();
      const manager = await fixtures.createUser({ role_access: "manager" });
      const patch = { status: "active" as const, publish_at: null, ...schedule() };

      expect(await updateEventSchedule(clientAs(member), event.id, patch)).toBeNull();
      // admin_update_events admits role 'admin' only, which is why
      // updateEventScheduleAction writes a manager's change with the service
      // role. When that policy moves to is_admin(), this becomes the row.
      expect(await updateEventSchedule(clientAs(manager), event.id, patch)).toBeNull();
      expect((await fetchEventById(fixtures.supabase, event.id))!.status).toBe("draft");
    }));

  it("is refused by the database for a publish date on an active event", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "active" });
      const admin = await fixtures.createUser({ role_access: "admin" });

      await expect(
        updateEventSchedule(clientAs(admin), event.id, {
          status: "active",
          publish_at: new Date(Date.now() + hour).toISOString(),
          ...schedule(),
        })
      ).rejects.toMatchObject({ message: "Only draft events can have a publish date." });
    }));
});
