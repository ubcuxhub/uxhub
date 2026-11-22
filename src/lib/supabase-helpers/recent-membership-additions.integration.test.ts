import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchRecentMembershipAdditions } from "./admin-dashboard";

function check(error: unknown) { if (error) throw error; }

describe("rolling membership additions", () => {
  it("counts unique first awards in exactly 720 hours across month and DST boundaries", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const at = "2045-11-15T12:00:00Z";
    const start = new Date(Date.parse(at) - 720 * 60 * 60 * 1000).toISOString();
    const times = [new Date(Date.parse(start) - 1).toISOString(), start,
      "2045-11-01T12:00:00Z", at, "2045-11-15T12:00:00.001Z"];
    const people = [];
    for (const [i, time] of times.entries()) {
      const person = await f.createUser();
      people.push(person);
      check((await f.supabase.rpc("record_membership_award", {
        p_person_id: person.id, p_awarded_at: time, p_source: i % 2 ? "manual" : "purchase",
      })).error);
    }
    // Repeat awards/tier changes never add another member in the same year.
    check((await f.supabase.rpc("record_membership_award", {
      p_person_id: people[1].id, p_awarded_at: at, p_source: "purchase",
    })).error);
    for (const staff of [admin, manager]) {
      expect(await fetchRecentMembershipAdditions(clientAs(staff), at)).toEqual({ count: 3, coverage: "complete" });
    }
    // Durable counts survive profile deletion.
    check((await f.supabase.from("user_info").delete().eq("id", people[2].id)).error);
    expect(await fetchRecentMembershipAdditions(clientAs(admin), at)).toEqual({ count: 3, coverage: "complete" });
  }));

  it("crosses a calendar year and retains late-April awards in the May rolling window", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    for (const time of ["2046-12-25T12:00:00Z", "2047-01-01T12:00:00Z", "2047-04-30T12:00:00Z"]) {
      const person = await f.createUser();
      check((await f.supabase.rpc("record_membership_award", { p_person_id: person.id, p_awarded_at: time, p_source: "manual" })).error);
    }
    const db = clientAs(admin);
    expect(await fetchRecentMembershipAdditions(db, "2047-01-15T12:00:00Z")).toEqual({ count: 2, coverage: "complete" });
    expect(await fetchRecentMembershipAdditions(db, "2047-05-15T12:00:00Z")).toEqual({ count: 1, coverage: "complete" });
    expect(await fetchRecentMembershipAdditions(db, "2047-07-15T12:00:00Z")).toEqual({ count: 0, coverage: "complete" });
  }));

  it("distinguishes unknown history from known partial awards and a true zero", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const db = clientAs(admin);
    const at = "1901-11-15T12:00:00Z";
    expect(await fetchRecentMembershipAdditions(db, at)).toEqual({ count: null, coverage: "unavailable" });
    const person = await f.createUser();
    check((await f.supabase.rpc("record_membership_award", { p_person_id: person.id, p_awarded_at: at, p_source: "purchase" })).error);
    expect(await fetchRecentMembershipAdditions(db, at)).toEqual({ count: 1, coverage: "partial" });
    expect(await fetchRecentMembershipAdditions(db, "2048-11-15T12:00:00Z")).toEqual({ count: 0, coverage: "complete" });
    const invalid = await db.rpc("admin_recent_membership_additions", { p_now: null as unknown as string });
    expect(invalid.error).toMatchObject({ message: "Report time required" });
  }));

  it("rejects ordinary members and anonymous callers without exposing the private ledger", () => withFixtures(async (f) => {
    const member = await f.createUser();
    for (const viewer of [member, null]) {
      await expect(fetchRecentMembershipAdditions(clientAs(viewer), "2045-11-15T12:00:00Z")).rejects.toMatchObject({ code: "42501" });
    }
  }));
});
