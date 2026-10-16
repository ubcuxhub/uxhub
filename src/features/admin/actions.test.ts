import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const guards = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireManager: vi.fn(),
}));
const adminServer = vi.hoisted(() => ({
  adminDeleteEventImageByUrl: vi.fn(),
  adminUpdateMembershipTermEndsAt: vi.fn(),
  adminUpdateMembershipTypeById: vi.fn(),
  adminUpdateUserInfoById: vi.fn(),
}));
const events = vi.hoisted(() => ({
  fetchEventById: vi.fn(),
  fetchEventIdByImageUrl: vi.fn(),
  fetchEventSlugsByPrefix: vi.fn(),
}));
const checkIns = vi.hoisted(() => ({
  fetchAttendingRegistrations: vi.fn(),
  fetchCheckInId: vi.fn(),
  fetchCheckInSessions: vi.fn(),
  fetchCheckInStatuses: vi.fn(),
  insertCheckIn: vi.fn(),
  updateCheckInTimestamp: vi.fn(),
}));
const registrations = vi.hoisted(() => ({
  fetchRegistrationsForEvent: vi.fn(),
  updateEventRegistration: vi.fn(),
}));
const eventPeople = vi.hoisted(() => ({
  saveMentor: vi.fn(),
  saveSponsor: vi.fn(),
}));
const adminRpc = vi.hoisted(() => vi.fn());
const serverRpc = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/supabase-helpers/admin-server", () => adminServer);
vi.mock("@/lib/supabase-helpers/events", () => events);
vi.mock("@/lib/supabase-helpers/check-ins", () => checkIns);
vi.mock("@/lib/supabase-helpers/event-registrations", () => registrations);
vi.mock("@/lib/supabase-helpers/event-people", () => eventPeople);
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { rpc: adminRpc } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: serverRpc })),
}));

// The slug, date, and membership-tier validators are left real. Each action
// delegates its rejection decision to them, so mocking them would only prove
// the mock rejects what it was told to.
import {
  deleteAdminEventAction,
  discardUnusedEventImageAction,
  fetchAdminCheckInSnapshotAction,
  saveAdminEventAction,
  saveAdminMentorAction,
  saveAdminSponsorAction,
  setMembershipTermEndsAtAction,
  toggleCheckInAction,
  updateApplicationStatusAction,
  updateManagerUserAction,
  updateMembershipTypeAction,
  updateUserRoleAction,
} from "./actions";

const manager = { id: "manager-1" } as UserInfoRow;
const admin = { id: "admin-1" } as UserInfoRow;

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireManager.mockResolvedValue(manager);
  guards.requireAdmin.mockResolvedValue(admin);
  adminServer.adminUpdateUserInfoById.mockResolvedValue(undefined);
  adminServer.adminDeleteEventImageByUrl.mockResolvedValue(undefined);
  events.fetchEventSlugsByPrefix.mockResolvedValue([]);
  adminRpc.mockResolvedValue({ data: { id: "event-1" }, error: null });
});

// ---------------------------------------------------------------------------
// The manager column allowlist
// ---------------------------------------------------------------------------

describe("updateManagerUserAction: the column allowlist", () => {
  it.each([
    "role_access",
    "id",
    "auth_user_id",
    "membership_expires_at",
    "membership_pre_ordered_type_id",
    "square_customer_id",
    "created_at",
  ])("refuses to write the unlisted column %s", async (field) => {
    await expect(
      updateManagerUserAction("user-1", field, "anything"),
    ).rejects.toThrow("This user field cannot be edited.");

    // This write goes through the service role, which bypasses RLS. The
    // allowlist is the only thing between a manager and a privilege
    // escalation, so nothing may reach the helper.
    expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
  });

  it.each([
    "first_name",
    "last_name",
    "email",
    "phone",
    "newsletter",
    "student_number",
    "faculty",
    "major",
    "membership_type_id",
  ])("writes the allowlisted column %s", async (field) => {
    await updateManagerUserAction("user-1", field, "value");

    expect(adminServer.adminUpdateUserInfoById).toHaveBeenCalledWith("user-1", {
      [field]: "value",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("maps the form's order_date onto the deprecated column", async () => {
    await updateManagerUserAction("user-1", "order_date", "2026-01-05");

    expect(adminServer.adminUpdateUserInfoById).toHaveBeenCalledWith("user-1", {
      order_date_deprecated: "2026-01-05",
    });
  });

  it("trims whitespace around a name", async () => {
    await updateManagerUserAction("user-1", "first_name", "  Jamie  ");

    expect(adminServer.adminUpdateUserInfoById).toHaveBeenCalledWith("user-1", {
      first_name: "Jamie",
    });
  });

  it.each([
    ["first_name", "First name is required."],
    ["last_name", "Last name is required."],
  ])("rejects a blank %s", async (field, message) => {
    await expect(updateManagerUserAction("user-1", field, "   ")).rejects.toThrow(
      message,
    );
    expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
  });

  it("rejects a name that is not a string", async () => {
    await expect(
      updateManagerUserAction("user-1", "first_name", 7),
    ).rejects.toThrow("First name is required.");
    expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
  });

  it.each(["6", "0", "first", ""])(
    "rejects the university year %s",
    async (year) => {
      await expect(
        updateManagerUserAction("user-1", "year", year),
      ).rejects.toThrow("Invalid university year.");
      expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
    },
  );

  it.each(["1", "2", "3", "4", "5+"])("accepts the year %s", async (year) => {
    await updateManagerUserAction("user-1", "year", year);

    expect(adminServer.adminUpdateUserInfoById).toHaveBeenCalledWith("user-1", {
      year,
    });
  });

  it("allows clearing the year", async () => {
    await updateManagerUserAction("user-1", "year", null);

    expect(adminServer.adminUpdateUserInfoById).toHaveBeenCalledWith("user-1", {
      year: null,
    });
  });

  it("requires a user id", async () => {
    await expect(updateManagerUserAction("", "major", "Art")).rejects.toThrow(
      "A user id is required.",
    );
    expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
  });

  it("checks the manager guard before validating anything", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireManager.mockRejectedValue(redirect);

    await expect(updateManagerUserAction("user-1", "major", "Art")).rejects.toBe(
      redirect,
    );
    expect(adminServer.adminUpdateUserInfoById).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The role check
// ---------------------------------------------------------------------------

describe("updateUserRoleAction: the role check", () => {
  it.each(["basic", "admin", "manager"] as const)(
    "sets the role %s through the database function",
    async (role) => {
      serverRpc.mockResolvedValue({ data: role, error: null });

      await expect(updateUserRoleAction("user-1", role)).resolves.toBe(role);

      expect(serverRpc).toHaveBeenCalledWith("set_user_role", {
        p_target_user_id: "user-1",
        p_role: role,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
    },
  );

  it.each(["owner", "superuser", "service_role", "", "ADMIN"])(
    "rejects the role %s without calling the database",
    async (role) => {
      await expect(
        updateUserRoleAction("user-1", role as "basic"),
      ).rejects.toThrow("Invalid role.");
      expect(serverRpc).not.toHaveBeenCalled();
    },
  );

  it("requires a user id", async () => {
    await expect(updateUserRoleAction("", "admin")).rejects.toThrow(
      "A user id is required.",
    );
    expect(serverRpc).not.toHaveBeenCalled();
  });

  it("surfaces a database error without revalidating", async () => {
    const failure = new Error("rls denied");
    serverRpc.mockResolvedValue({ data: null, error: failure });

    await expect(updateUserRoleAction("user-1", "admin")).rejects.toBe(failure);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails when the function returns no role", async () => {
    serverRpc.mockResolvedValue({ data: null, error: null });

    await expect(updateUserRoleAction("user-1", "admin")).rejects.toThrow(
      "The role update returned no role.",
    );
  });

  it("requires a manager", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireManager.mockRejectedValue(redirect);

    await expect(updateUserRoleAction("user-1", "admin")).rejects.toBe(redirect);
    expect(serverRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The image-discard check
// ---------------------------------------------------------------------------

describe("discardUnusedEventImageAction: the reference check", () => {
  it("leaves an image that an event still references", async () => {
    events.fetchEventIdByImageUrl.mockResolvedValue("event-9");

    await discardUnusedEventImageAction("https://store/img.png");

    // This action takes a URL straight from the client, so the reference check
    // is the only thing stopping a caller deleting a live event's cover image.
    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("deletes an image no event references", async () => {
    events.fetchEventIdByImageUrl.mockResolvedValue(null);

    await discardUnusedEventImageAction("https://store/orphan.png");

    expect(adminServer.adminDeleteEventImageByUrl).toHaveBeenCalledWith(
      "https://store/orphan.png",
    );
  });

  it("ignores an empty url without querying", async () => {
    await discardUnusedEventImageAction("");

    expect(events.fetchEventIdByImageUrl).not.toHaveBeenCalled();
    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("swallows a storage failure", async () => {
    events.fetchEventIdByImageUrl.mockResolvedValue(null);
    adminServer.adminDeleteEventImageByUrl.mockRejectedValue(
      new Error("storage down"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      discardUnusedEventImageAction("https://store/orphan.png"),
    ).resolves.toBeUndefined();

    consoleError.mockRestore();
  });

  it("requires an admin", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireAdmin.mockRejectedValue(redirect);

    await expect(
      discardUnusedEventImageAction("https://store/orphan.png"),
    ).rejects.toBe(redirect);
    expect(events.fetchEventIdByImageUrl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

const saveInput = {
  expectedImageUrl: null,
  event: { name: "Design Sprint" },
  checkInSessions: [],
  mentorIds: [],
  sponsorIds: [],
  applicationQuestions: [],
};

describe("saveAdminEventAction", () => {
  it("generates a slug when creating and omits one when updating", async () => {
    await saveAdminEventAction(saveInput);
    expect(adminRpc.mock.calls[0][1]).toMatchObject({
      p_event_id: null,
      p_slug: "design-sprint",
    });

    adminRpc.mockClear();
    await saveAdminEventAction({ ...saveInput, eventId: "event-1" });
    expect(adminRpc.mock.calls[0][1]).toMatchObject({
      p_event_id: "event-1",
      p_slug: null,
    });
  });

  it("falls back to a usable slug when the name yields none", async () => {
    await saveAdminEventAction({ ...saveInput, event: { name: "!!!" } });

    expect(events.fetchEventSlugsByPrefix).toHaveBeenCalledWith(
      expect.anything(),
      "event",
    );
    expect(adminRpc.mock.calls[0][1].p_slug).toBeTruthy();
  });

  it("forwards the cover image the form loaded with as the precondition", async () => {
    await saveAdminEventAction({
      ...saveInput,
      eventId: "event-1",
      expectedImageUrl: "https://store/old.png",
    });

    expect(adminRpc.mock.calls[0][1]).toMatchObject({
      p_expected_image_url: "https://store/old.png",
    });
  });

  it("translates the image-conflict sentinel into a readable message", async () => {
    adminRpc.mockResolvedValue({
      data: null,
      error: new Error("raised EVENT_IMAGE_CONFLICT for event"),
    });

    await expect(
      saveAdminEventAction({ ...saveInput, eventId: "event-1" }),
    ).rejects.toThrow(/cover image was changed somewhere else/);
  });

  it("passes through an unrelated database error", async () => {
    const failure = new Error("null value in column");
    adminRpc.mockResolvedValue({ data: null, error: failure });

    await expect(saveAdminEventAction(saveInput)).rejects.toBe(failure);
  });

  it("fails when the save returns no id", async () => {
    adminRpc.mockResolvedValue({ data: null, error: null });

    await expect(saveAdminEventAction(saveInput)).rejects.toThrow(
      "The event save returned no event id.",
    );
  });

  it("discards the replaced cover image once the update lands", async () => {
    await saveAdminEventAction({
      ...saveInput,
      eventId: "event-1",
      expectedImageUrl: "https://store/old.png",
      event: { name: "Design Sprint", image_url: "https://store/new.png" },
    });

    expect(adminServer.adminDeleteEventImageByUrl).toHaveBeenCalledWith(
      "https://store/old.png",
    );
  });

  it("keeps the cover image when it did not change", async () => {
    await saveAdminEventAction({
      ...saveInput,
      eventId: "event-1",
      expectedImageUrl: "https://store/same.png",
      event: { name: "Design Sprint", image_url: "https://store/same.png" },
    });

    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("discards nothing when creating", async () => {
    await saveAdminEventAction({
      ...saveInput,
      expectedImageUrl: "https://store/old.png",
    });

    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("keeps the saved event when discarding the old image fails", async () => {
    adminServer.adminDeleteEventImageByUrl.mockRejectedValue(
      new Error("storage down"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // A leaked storage object is cheaper than failing a save that already
    // committed, so the cleanup failure stays swallowed.
    await expect(
      saveAdminEventAction({
        ...saveInput,
        eventId: "event-1",
        expectedImageUrl: "https://store/old.png",
        event: { name: "Design Sprint", image_url: "https://store/new.png" },
      }),
    ).resolves.toEqual({ id: "event-1" });

    consoleError.mockRestore();
  });

  it("requires an admin before touching the database", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireAdmin.mockRejectedValue(redirect);

    await expect(saveAdminEventAction(saveInput)).rejects.toBe(redirect);
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe("deleteAdminEventAction", () => {
  it("deletes the event and then its cover image", async () => {
    events.fetchEventById.mockResolvedValue({
      id: "event-1",
      image_url: "https://store/cover.png",
    });
    adminRpc.mockResolvedValue({ error: null });

    await deleteAdminEventAction("event-1");

    expect(adminRpc).toHaveBeenCalledWith("delete_event_atomically", {
      target_event_id: "event-1",
    });
    expect(adminServer.adminDeleteEventImageByUrl).toHaveBeenCalledWith(
      "https://store/cover.png",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events");
  });

  it("keeps the image when the delete fails", async () => {
    const failure = new Error("foreign key violation");
    events.fetchEventById.mockResolvedValue({
      id: "event-1",
      image_url: "https://store/cover.png",
    });
    adminRpc.mockResolvedValue({ error: failure });

    await expect(deleteAdminEventAction("event-1")).rejects.toBe(failure);
    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("copes with an event that has no cover image", async () => {
    events.fetchEventById.mockResolvedValue({ id: "event-1", image_url: null });
    adminRpc.mockResolvedValue({ error: null });

    await deleteAdminEventAction("event-1");

    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("copes with an event that no longer exists", async () => {
    events.fetchEventById.mockResolvedValue(null);
    adminRpc.mockResolvedValue({ error: null });

    await expect(deleteAdminEventAction("event-1")).resolves.toBeUndefined();
    expect(adminServer.adminDeleteEventImageByUrl).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireAdmin.mockRejectedValue(redirect);

    await expect(deleteAdminEventAction("event-1")).rejects.toBe(redirect);
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

describe("toggleCheckInAction", () => {
  it("inserts a check-in the first time someone is checked in", async () => {
    checkIns.fetchCheckInId.mockResolvedValue(null);

    const at = await toggleCheckInAction("reg-1", "session-1", true);

    expect(checkIns.insertCheckIn).toHaveBeenCalledWith(expect.anything(), {
      event_registration_id: "reg-1",
      check_in_session_id: "session-1",
      checked_in_at: at,
    });
    expect(checkIns.updateCheckInTimestamp).not.toHaveBeenCalled();
    expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("clears the timestamp on an existing row when unchecking", async () => {
    checkIns.fetchCheckInId.mockResolvedValue("check-in-1");

    await expect(
      toggleCheckInAction("reg-1", "session-1", false),
    ).resolves.toBeNull();

    expect(checkIns.updateCheckInTimestamp).toHaveBeenCalledWith(
      expect.anything(),
      "check-in-1",
      null,
    );
    expect(checkIns.insertCheckIn).not.toHaveBeenCalled();
  });

  it("re-stamps an existing row when checking in again", async () => {
    checkIns.fetchCheckInId.mockResolvedValue("check-in-1");

    const at = await toggleCheckInAction("reg-1", "session-1", true);

    expect(checkIns.updateCheckInTimestamp).toHaveBeenCalledWith(
      expect.anything(),
      "check-in-1",
      at,
    );
    expect(at).not.toBeNull();
  });

  it("writes nothing when unchecking someone who was never checked in", async () => {
    checkIns.fetchCheckInId.mockResolvedValue(null);

    await expect(
      toggleCheckInAction("reg-1", "session-1", false),
    ).resolves.toBeNull();

    expect(checkIns.insertCheckIn).not.toHaveBeenCalled();
    expect(checkIns.updateCheckInTimestamp).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireAdmin.mockRejectedValue(redirect);

    await expect(toggleCheckInAction("reg-1", "session-1", true)).rejects.toBe(
      redirect,
    );
    expect(checkIns.insertCheckIn).not.toHaveBeenCalled();
  });
});

describe("fetchAdminCheckInSnapshotAction", () => {
  it("returns the four sources as one snapshot with statuses serialized", async () => {
    checkIns.fetchCheckInSessions.mockResolvedValue([{ id: "session-1" }]);
    checkIns.fetchAttendingRegistrations.mockResolvedValue([{ id: "reg-1" }]);
    checkIns.fetchCheckInStatuses.mockResolvedValue(new Map([["reg-1", true]]));
    registrations.fetchRegistrationsForEvent.mockResolvedValue([
      { id: "reg-1" },
      { id: "reg-2" },
    ]);

    await expect(fetchAdminCheckInSnapshotAction("event-1")).resolves.toEqual({
      sessions: [{ id: "session-1" }],
      registrations: [{ id: "reg-1" }],
      // A Map cannot cross the server-action boundary, so it ships as entries.
      statuses: [["reg-1", true]],
      allRegistrations: [{ id: "reg-1" }, { id: "reg-2" }],
    });
  });
});

// ---------------------------------------------------------------------------
// The rest of the file, so a rejection anywhere in it stops short of a write
// ---------------------------------------------------------------------------

describe("updateApplicationStatusAction", () => {
  it.each(["pending", "accepted", "declined"] as const)(
    "records the reviewer alongside the status %s",
    async (status) => {
      await updateApplicationStatusAction("reg-1", status);

      expect(registrations.updateEventRegistration).toHaveBeenCalledWith(
        expect.anything(),
        "reg-1",
        { status, reviewer_id: admin.id },
      );
    },
  );

  it("rejects a status outside the known set", async () => {
    await expect(
      updateApplicationStatusAction("reg-1", "approved" as "accepted"),
    ).rejects.toThrow("Invalid application status.");
    expect(registrations.updateEventRegistration).not.toHaveBeenCalled();
  });
});

describe("saveAdminMentorAction and saveAdminSponsorAction", () => {
  it("rejects a blank mentor name", async () => {
    await expect(
      saveAdminMentorAction({ full_name: "   " } as never),
    ).rejects.toThrow("Mentor name is required.");
    expect(eventPeople.saveMentor).not.toHaveBeenCalled();
  });

  it("rejects a blank sponsor name", async () => {
    await expect(
      saveAdminSponsorAction({ name: "   " } as never),
    ).rejects.toThrow("Sponsor name is required.");
    expect(eventPeople.saveSponsor).not.toHaveBeenCalled();
  });

  it("saves a named mentor", async () => {
    const mentor = { id: "mentor-1", full_name: "Ada" };
    eventPeople.saveMentor.mockResolvedValue(mentor);

    await expect(
      saveAdminMentorAction({ full_name: "Ada" } as never),
    ).resolves.toBe(mentor);
  });
});

describe("setMembershipTermEndsAtAction", () => {
  it.each(["2026-1-05", "05-01-2026", "next friday", "2026-01-05T10:00"])(
    "rejects the malformed date %s",
    async (date) => {
      await expect(setMembershipTermEndsAtAction(date)).rejects.toThrow(
        "Enter a valid date.",
      );
      expect(adminServer.adminUpdateMembershipTermEndsAt).not.toHaveBeenCalled();
    },
  );

  it("stores the end of the chosen day in Pacific time", async () => {
    const stored = await setMembershipTermEndsAtAction("2026-04-30");

    expect(adminServer.adminUpdateMembershipTermEndsAt).toHaveBeenCalledWith(
      stored,
      manager.id,
    );
    // The stored instant is UTC, so it lands on May 1 there; read back in
    // Vancouver it has to still be the end of April 30, or a member loses the
    // afternoon they were told they had.
    expect(
      new Date(stored as string).toLocaleString("sv-SE", {
        timeZone: "America/Vancouver",
      }),
    ).toBe("2026-04-30 23:59:59");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("clears the ceiling when given null", async () => {
    await expect(setMembershipTermEndsAtAction(null)).resolves.toBeNull();

    expect(adminServer.adminUpdateMembershipTermEndsAt).toHaveBeenCalledWith(
      null,
      manager.id,
    );
  });
});

describe("updateMembershipTypeAction", () => {
  const tier = { active: true, description: "Full year access", price: 15 };

  beforeEach(() => {
    adminServer.adminUpdateMembershipTypeById.mockResolvedValue([tier]);
  });

  it("writes only the three editable columns", async () => {
    await updateMembershipTypeAction("tier-1", {
      ...tier,
      // Renaming breaks printed receipts and live checkout URLs, and emptying
      // the audience makes a tier unpurchasable, so these are dropped rather
      // than forwarded.
      name: "Renamed",
      slug: "renamed",
      eligible_user_types: [],
    } as never);

    expect(adminServer.adminUpdateMembershipTypeById).toHaveBeenCalledWith(
      "tier-1",
      { active: true, description: "Full year access", price: 15 },
    );
  });

  it("trims the description before validating and writing", async () => {
    await updateMembershipTypeAction("tier-1", {
      ...tier,
      description: "  Full year access  ",
    } as never);

    expect(adminServer.adminUpdateMembershipTypeById).toHaveBeenCalledWith(
      "tier-1",
      expect.objectContaining({ description: "Full year access" }),
    );
  });

  it("requires a tier id", async () => {
    await expect(updateMembershipTypeAction("", tier as never)).rejects.toThrow(
      "Membership tier not found.",
    );
    expect(adminServer.adminUpdateMembershipTypeById).not.toHaveBeenCalled();
  });

  it("fails when the tier no longer exists", async () => {
    adminServer.adminUpdateMembershipTypeById.mockResolvedValue([]);

    await expect(
      updateMembershipTypeAction("tier-1", tier as never),
    ).rejects.toThrow("Membership tier not found.");
  });

  it("returns the price as a number", async () => {
    adminServer.adminUpdateMembershipTypeById.mockResolvedValue([
      { ...tier, price: "15.00" },
    ]);

    await expect(
      updateMembershipTypeAction("tier-1", tier as never),
    ).resolves.toEqual({
      active: true,
      description: "Full year access",
      price: 15,
    });
  });
});
