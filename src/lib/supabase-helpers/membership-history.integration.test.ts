import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchMajorDistribution, fetchMembershipHistory } from "./admin-dashboard";
import { fulfillMembershipGrant } from "./membership-history";
import { saveAdminProfile } from "./admin-user-profile";

vi.mock("server-only", () => ({}));
function check(error: unknown) { if (error) throw error; }

const reportTime = "2030-11-20T12:00:00Z";

describe("durable membership history", () => {
  it("deduplicates concurrent grants, imports earlier reliable dates, and reconciles monthly summaries", () => withFixtures(async (f) => {
    const db = f.supabase;
    const admin = await f.createUser({ role_access: "admin" });
    const people = [await f.createUser(), await f.createUser()];
    const award = (person: string, at: string, source = "purchase") => db.rpc("record_membership_award", {
      p_person_id: person, p_awarded_at: at, p_source: source,
    });
    for (const result of await Promise.all(Array.from({ length: 12 }, (_, i) =>
      award(people[0].id, "2030-11-10T12:00:00Z", i % 2 ? "purchase" : "manual")))) check(result.error);
    check((await award(people[1].id, "2030-11-15T12:00:00Z")).error);
    check((await award(people[0].id, "2030-12-01T12:00:00Z")).error);
    // Importing older reliable evidence moves the first month, rather than
    // incrementing again or leaving a stale November summary.
    check((await award(people[0].id, "2030-10-10T12:00:00Z")).error);
    for (let n = 0; n < 2; n++) check((await db.rpc("rebuild_membership_history")).error);
    const report = await fetchMembershipHistory(clientAs(admin), reportTime, { firstYear: 2030 });
    expect(report.years[0]).toMatchObject({ academicYear: 2030, count: 2, coverage: "complete" });
    expect(report.years[0].months.slice(0, 4)).toEqual([
      { month: "2030-09-01", count: 0, coverage: "complete" },
      { month: "2030-10-01", count: 1, coverage: "complete" },
      { month: "2030-11-01", count: 1, coverage: "complete" },
      { month: "2030-12-01", count: null, coverage: "future" },
    ]);
    const summary = await db.from("membership_award_months").select("month,total").gte("month", "2030-09-01").lt("month", "2031-05-01").order("month");
    check(summary.error);
    expect(summary.data).toEqual([{ month: "2030-10-01", total: 1 }, { month: "2030-11-01", total: 1 }]);
    // Neither removal/anonymization nor physical profile deletion erases history.
    check((await db.from("user_info").update({ deleted_at: reportTime, membership_type_id: null }).eq("id", people[0].id)).error);
    check((await db.from("user_info").delete().eq("id", people[1].id)).error);
    expect((await fetchMembershipHistory(clientAs(admin), reportTime, { firstYear: 2030 })).years).toEqual(report.years);
  }));

  it("uses Vancouver boundaries, excludes summer, and separates absent, partial, future and exact zero", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const person = await f.createUser();
    const dates = [
      "2019-11-01T12:00:00Z", // Reliable old purchase; manual history unknown.
      "2030-09-01T06:59:59Z", // August 31 Vancouver: excluded.
      "2030-09-01T07:00:00Z", // September 1 inclusive.
      "2031-05-01T06:59:59Z", // Same person/year: no second award.
      "2031-05-01T07:00:00Z", // May 1 exclusive.
      "2031-09-01T07:00:00Z", // Next academic year.
    ];
    for (const at of dates) check((await f.supabase.rpc("record_membership_award", { p_person_id: person.id, p_awarded_at: at, p_source: "purchase" })).error);
    const ledger = await f.supabase.from("membership_awards").select("academic_year,month").eq("person_id", person.id).order("academic_year");
    check(ledger.error);
    expect(ledger.data).toEqual([
      { academic_year: 2019, month: "2019-11-01" },
      { academic_year: 2030, month: "2030-09-01" },
      { academic_year: 2031, month: "2031-09-01" },
    ]);
    const historical = await fetchMembershipHistory(clientAs(admin), reportTime, { firstYear: 2018, lastYear: 2019 });
    expect(historical.years[0]).toMatchObject({ count: null, coverage: "unavailable" });
    expect(historical.years[1]).toMatchObject({ count: 1, coverage: "partial" });
    // Even a later fully observed month in the deployment year cannot promise
    // exact first-month attribution while earlier manual grants are unknown.
    const current = await fetchMembershipHistory(clientAs(admin), new Date().toISOString());
    const tracking = new Date(current.completeFrom);
    const trackingYear = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Vancouver", year: "numeric" }).format(tracking));
    const trackingMonth = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Vancouver", month: "numeric" }).format(tracking));
    if (trackingMonth >= 9 || trackingMonth <= 4) {
      const year = trackingYear - (trackingMonth < 9 ? 1 : 0);
      const rollout = await fetchMembershipHistory(clientAs(admin), `${year + 1}-05-01T07:00:00Z`, { firstYear: year, lastYear: year });
      expect(rollout.years[0].coverage).toBe("partial");
      expect(rollout.years[0].months.some((m) => m.coverage === "complete")).toBe(false);
    }
    const empty = await fetchMembershipHistory(clientAs(admin), "2033-11-20T12:00:00Z", { firstYear: 2033 });
    expect(empty.years[0]).toMatchObject({ count: 0, coverage: "complete" });
    const future = await fetchMembershipHistory(clientAs(admin), reportTime, { firstYear: 2031, lastYear: 2031 });
    expect(future.years[0]).toMatchObject({ count: null, coverage: "future" });
    expect(future.years[0].months.every((m) => m.count === null)).toBe(true);
    expect((await fetchMembershipHistory(clientAs(admin), "2031-07-01T00:00:00Z", { firstYear: 2030 })).latestAcademicYear).toBe(2030);
    // DST fall-back has two distinct UTC instants in the same local month.
    for (const at of ["2032-11-07T08:30:00Z", "2032-11-07T09:30:00Z"]) check((await f.supabase.rpc("record_membership_award", { p_person_id: person.id, p_awarded_at: at, p_source: "manual" })).error);
    const dst = await f.supabase.from("membership_awards").select("month").eq("person_id", person.id).eq("academic_year", 2032);
    expect(dst.data).toEqual([{ month: "2032-11-01" }]);
  }));

  it("backfills reliable fulfillment dates repeatedly and resets only named fixtures", () => withFixtures(async (f) => {
    const db = f.supabase;
    const tier = await f.createMembershipType();
    const person = await f.createUser({ membership_type_id: tier.id });
    const undated = await f.createUser({ membership_type_id: tier.id });
    // Re-saving an existing undated tier is not a newly dated manual grant.
    await saveAdminProfile(db, undated.id, { membership_type_id: tier.id });
    const purchases = await db.from("purchases").insert([
      { user_id: person.id, kind: "membership", status: "completed", membership_type_id: tier.id,
        amount_cents: 1000, currency: "CAD", idempotency_key: randomUUID(), fulfilled_at: "2020-11-15T12:00:00Z" },
      { user_id: person.id, kind: "membership", status: "completed", membership_type_id: tier.id,
        amount_cents: 1000, currency: "CAD", idempotency_key: randomUUID(), fulfilled_at: "2020-10-15T12:00:00Z" },
    ]).select("id");
    check(purchases.error);
    check((await db.from("membership_awards").delete().eq("person_id", person.id)).error);
    for (let n = 0; n < 2; n++) check((await db.rpc("rebuild_membership_history")).error);
    const imported = await db.from("membership_awards").select("month,source").eq("person_id", person.id);
    expect(imported.data).toEqual([{ month: "2020-10-01", source: "purchase" }]);
    expect((await db.from("membership_awards").select("*").eq("person_id", undated.id)).data).toEqual([]);
    // Summer boundaries must exclude first awards too, independently of dedup.
    for (const at of ["2030-05-01T07:00:00Z", "2030-08-31T12:00:00Z"]) {
      check((await db.rpc("record_membership_award", { p_person_id: undated.id, p_awarded_at: at, p_source: "manual" })).error);
    }
    expect((await db.from("membership_awards").select("*").eq("person_id", undated.id)).data).toEqual([]);
    check((await db.rpc("record_membership_award", { p_person_id: undated.id, p_awarded_at: "2031-05-01T06:59:59Z", p_source: "manual" })).error);
    expect((await db.from("membership_awards").select("month").eq("person_id", undated.id)).data).toEqual([{ month: "2031-04-01" }]);
    // Pruned purchases do not remove normal durable history on rebuild.
    check((await db.from("purchases").delete().in("id", purchases.data!.map((p) => p.id))).error);
    check((await db.rpc("rebuild_membership_history")).error);
    expect((await db.from("membership_awards").select("month,source").eq("person_id", person.id)).data).toEqual(imported.data);
    // Explicit fixture reset removes only its targets, leaving other people.
    check((await db.rpc("reset_fixture_membership_history", { p_person_ids: [person.id] })).error);
    expect((await db.from("membership_awards").select("*").eq("person_id", person.id)).data).toEqual([]);
    expect((await db.from("membership_awards").select("*").eq("person_id", undated.id)).data).toHaveLength(1);
  }));

  it("commits fulfillment atomically, retries once, ignores failed/pending purchases and preorders, and records both manual-edit paths", () => withFixtures(async (f) => {
    const db = f.supabase;
    const tier = await f.createMembershipType();
    const person = await f.createUser({ membership_pre_ordered_type_id: tier.id });
    const purchase = async (status: "completed" | "failed" | "pending", userId = person.id) => {
      const result = await db.from("purchases").insert({ user_id: userId, kind: "membership", status,
        membership_type_id: tier.id, amount_cents: 1000, currency: "CAD", idempotency_key: randomUUID() }).select("*").single();
      check(result.error);
      return result.data!;
    };
    const pending = await purchase("pending");
    const failed = await purchase("failed");
    for (const p of [pending, failed]) await expect(fulfillMembershipGrant(db, p.id, "2040-01-01T00:00:00Z")).rejects.toBeTruthy();
    const before = await db.from("membership_awards").select("*").eq("person_id", person.id);
    expect(before.data).toEqual([]);
    const completed = await purchase("completed");
    const results = await Promise.all(Array.from({ length: 5 }, () => fulfillMembershipGrant(db, completed.id, "2040-01-01T00:00:00Z")));
    expect(results.every((p) => p.fulfilled_at === results[0].fulfilled_at && p.fulfilled_at !== null)).toBe(true);
    const profile = await db.from("user_info").select("membership_type_id,membership_expires_at,membership_pre_ordered_type_id").eq("id", person.id).single();
    expect(profile.data).toMatchObject({ membership_type_id: tier.id, membership_pre_ordered_type_id: null, membership_expires_at: "2040-01-01T00:00:00+00:00" });
    const ledgerBefore = await db.from("membership_awards").select("*").eq("person_id", person.id);
    check(ledgerBefore.error);
    // Successful retries and both profile helpers share the same unique key.
    await saveAdminProfile(db, person.id, { membership_type_id: tier.id });
    check((await db.from("user_info").update({ membership_type_id: tier.id }).eq("id", person.id)).error);
    check((await db.from("purchases").update({ refunded_cents: 1000 }).eq("id", completed.id)).error);
    const ledgerAfter = await db.from("membership_awards").select("*").eq("person_id", person.id);
    expect(ledgerAfter.data).toEqual(ledgerBefore.data);
    const manual = await f.createUser();
    await saveAdminProfile(db, manual.id, { membership_type_id: tier.id, membership_expires_at: "2040-01-01T00:00:00Z" });
    const manualRows = await db.from("membership_awards").select("source").eq("person_id", manual.id);
    // May–August intentionally produces no awards.
    const month = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Vancouver", month: "numeric" }).format(new Date()));
    expect(manualRows.data).toEqual(month >= 5 && month <= 8 ? [] : [{ source: "manual" }]);
    const racing = await f.createUser();
    const racingPurchase = await purchase("completed", racing.id);
    await Promise.all([
      fulfillMembershipGrant(db, racingPurchase.id, "2040-01-01T00:00:00Z"),
      saveAdminProfile(db, racing.id, { membership_type_id: tier.id }),
    ]);
    const raced = await db.from("membership_awards").select("*").eq("person_id", racing.id);
    expect(raced.data).toHaveLength(month >= 5 && month <= 8 ? 0 : 1);
    const deleted = await f.createUser({ deleted_at: reportTime });
    const unavailable = await purchase("completed", deleted.id);
    await expect(fulfillMembershipGrant(db, unavailable.id, "2040-01-01T00:00:00Z")).rejects.toBeTruthy();
    expect((await db.from("purchases").select("fulfilled_at").eq("id", unavailable.id).single()).data?.fulfilled_at).toBeNull();
  }));

  it("aggregates all-account majors, allows staff aggregates only, and denies direct history access and trusted writes", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const basic = await f.createUser({ major: f.tag });
    await f.createUser({ major: f.tag });
    await f.createUser({ major: ` ${f.tag} ` });
    await f.createUser({ major: `${f.tag}-deleted`, deleted_at: reportTime });
    await f.createUser({ major: " \t\n " });
    for (const staff of [admin, manager]) {
      const result = await fetchMajorDistribution(clientAs(staff));
      expect(result.majors.find((m) => m.major === f.tag)?.count).toBe(3);
      expect(result.majors.some((m) => m.major === `${f.tag}-deleted`)).toBe(false);
      expect(result.majors.find((m) => m.major === "Unknown")!.count).toBeGreaterThan(0);
      expect(result.totalAccounts).toBe(result.majors.reduce((n, m) => n + m.count, 0));
      await expect(fetchMembershipHistory(clientAs(staff), reportTime)).resolves.toBeTruthy();
    }
    for (const viewer of [admin, manager, basic, null]) {
      const client = clientAs(viewer);
      for (const table of ["membership_awards", "membership_award_months", "membership_history_coverage"] as const) {
        expect((await client.from(table).select("*")).error).toBeTruthy();
        expect((await client.from(table).delete().not(table === "membership_history_coverage" ? "id" : "month", "is", null)).error).toBeTruthy();
      }
      expect((await client.rpc("record_membership_award", { p_person_id: basic.id, p_awarded_at: reportTime, p_source: "manual" })).error).toBeTruthy();
      expect((await client.rpc("rebuild_membership_history")).error).toBeTruthy();
      expect((await client.rpc("reset_fixture_membership_history", { p_person_ids: [basic.id] })).error).toBeTruthy();
      expect((await client.rpc("fulfill_membership_purchase", { p_purchase_id: randomUUID(), p_expires_at: reportTime })).error).toBeTruthy();
      if (viewer === basic || viewer === null) {
        await expect(fetchMembershipHistory(client, reportTime)).rejects.toBeTruthy();
        await expect(fetchMajorDistribution(client)).rejects.toBeTruthy();
      }
    }
  }));
});
