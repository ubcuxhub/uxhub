import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchDashboardSearch, resolveDashboardRecents } from "./dashboard-search";
import { SEARCH_LIMIT } from "@/features/admin/lib/dashboard-search";

function check(error: unknown) { if (error) throw error; }
describe("dashboard search", () => {
  it("denies direct lookups and recent resolution to basic and anonymous viewers", () => withFixtures(async (f) => {
    const basic = await f.createUser();
    for (const db of [clientAs(basic), clientAs(null)]) {
      await expect(fetchDashboardSearch(db, "Integration", "all")).rejects.toMatchObject({ code: "42501" });
      await expect(resolveDashboardRecents(db, [])).rejects.toMatchObject({ code: "42501" });
    }
  }));
  it("matches names/email, projects only display fields, bounds results and resolves deletion", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const target = await f.createUser({ first_name: f.tag, last_name: "Searchperson" });
    for (let i = 0; i < SEARCH_LIMIT + 1; i++) await f.createUser({ first_name: f.tag, last_name: `Searchperson ${i}` });
    for (const viewer of [admin, manager]) {
      const db = clientAs(viewer);
      const rows = await fetchDashboardSearch(db, `${f.tag} Searchperson`, "all");
      expect(rows.filter((row) => row.kind === "user")).toHaveLength(SEARCH_LIMIT);
      expect(Object.keys(rows[0]).sort()).toEqual(["description", "id", "kind", "label"]);
      expect(await fetchDashboardSearch(db, target.email, "all")).toEqual([{ kind: "user", id: target.id, label: `${f.tag} Searchperson`, description: target.email }]);
      expect((await resolveDashboardRecents(db, [{ kind: "user", id: target.id }]))[0]?.id).toBe(target.id);
      expect(await fetchDashboardSearch(db, '%,)"_*', "all")).toEqual([]);
    }
    check((await f.supabase.from("user_info").update({ deleted_at: new Date().toISOString() }).eq("id", target.id)).error);
    expect(await resolveDashboardRecents(clientAs(admin), [{ kind: "user", id: target.id }])).toEqual([]);
  }));
  it("returns real event records, upcoming scope and submitted-only pending counts", () => withFixtures(async (f) => {
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const attendee = await f.createUser();
    const event = await f.createEvent({ name: `${f.tag} Search event`, status: "active", starts_at: "2300-01-01T00:00:00Z", ends_at: "2300-01-02T00:00:00Z", requires_application: true });
    const draft = await f.createEvent({ slug: `${f.tag}-draft`, name: `${f.tag} Draft`, status: "draft" });
    check((await f.supabase.from("event_applications").insert({ event_id: event.id, user_id: attendee.id, status: "submitted" })).error);
    for (const viewer of [admin, manager]) {
      const db = clientAs(viewer);
      expect((await fetchDashboardSearch(db, f.tag, "all")).filter((row) => row.kind === "event").map((row) => row.id).sort()).toEqual([event.id, draft.id].sort());
      expect((await fetchDashboardSearch(db, f.tag, "upcoming")).map((row) => row.id)).toEqual([event.id]);
      expect(await fetchDashboardSearch(db, f.tag, "pending")).toEqual([{ kind: "application", id: event.id, label: event.name, description: "1 pending application" }]);
      expect(await resolveDashboardRecents(db, [{ kind: "application", id: event.id }, { kind: "action", id: "statistics" }, { kind: "event", id: "00000000-0000-0000-0000-000000000000" }])).toHaveLength(2);
    }
    // Empty application-taking events must be filtered before the result bound.
    for (let i = 0; i < SEARCH_LIMIT + 1; i++) await f.createEvent({ slug: `${f.tag}-empty-${i}`, name: `${f.tag} A-empty-${i}`, requires_application: true });
    expect((await fetchDashboardSearch(clientAs(admin), f.tag, "pending")).map((row) => row.id)).toEqual([event.id]);
    check((await f.supabase.from("event_applications").update({ status: "rejected" }).eq("event_id", event.id)).error);
    expect(await fetchDashboardSearch(clientAs(admin), f.tag, "pending")).toEqual([]);
    expect(await resolveDashboardRecents(clientAs(admin), [{ kind: "application", id: event.id }])).toEqual([]);
  }));
});
