import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchUserExport } from "./user-export";
import { fetchMembershipTermEndsAt } from "./app-settings";
import { getEffectiveMembershipExpiry } from "@/features/memberships/lib/expiry";

describe("user export", () => {
  it("denies basic and anonymous database callers", () => withFixtures(async (f) => {
    const basic = await f.createUser();
    for (const db of [clientAs(basic), clientAs(null)]) await expect(fetchUserExport(db)).rejects.toMatchObject({ code: "42501" });
  }));
  it("exports every approved field once beyond the API cap for admin and manager, excluding deleted accounts", () => withFixtures(async (f) => {
    const tier = await f.createMembershipType();
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    const target = await f.createUser({ first_name: "Renée", last_name: "王", membership_type_id: tier.id, membership_expires_at: "2028-01-01T00:00:00Z", faculty: "Arts", major: 'Design, "UX"\nResearch', school_institution: "UBC", year: "1", student_number: 12345678 });
    const deleted = await f.createUser({ deleted_at: new Date().toISOString() });
    // Profile-only local fixtures exercise pagination without creating Auth logins.
    const bulk = Array.from({ length: 1005 }, (_, i) => ({ id: randomUUID(), email: `${f.tag}-bulk-${i}@example.test`, first_name: "Bulk", last_name: String(i), role_access: "basic" as const }));
    try {
      for (let offset = 0; offset < bulk.length; offset += 200) {
        const result = await f.supabase.from("user_info").insert(bulk.slice(offset, offset + 200));
        if (result.error) throw result.error;
      }
      for (const viewer of [admin, manager]) {
        const db = clientAs(viewer);
        const rows = await fetchUserExport(db);
        const fixtures = rows.filter((row) => row.email.startsWith(`${f.tag}-bulk-`));
        expect(fixtures).toHaveLength(bulk.length);
        expect(new Set(fixtures.map((row) => row.email)).size).toBe(bulk.length);
        expect(rows.some((row) => row.email === deleted.email)).toBe(false);
        expect(rows.find((row) => row.email === target.email)).toEqual({
          name: "Renée 王", email: target.email, role: "basic", membershipType: tier.name,
          membershipExpiry: getEffectiveMembershipExpiry(target, await fetchMembershipTermEndsAt(db)),
          faculty: "Arts", major: 'Design, "UX"\nResearch', school: "UBC", studyYear: "1", createdAt: target.created_at,
        });
        expect(fixtures[0].membershipType).toBeNull();
        expect(fixtures[0].membershipExpiry).toBeNull();
      }
    } finally {
      for (let offset = 0; offset < bulk.length; offset += 200) {
        const result = await f.supabase.from("user_info").delete().in("id", bulk.slice(offset, offset + 200).map((row) => row.id));
        if (result.error) throw result.error;
      }
    }
  }), 60000);
});
