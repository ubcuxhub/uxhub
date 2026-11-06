import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { clientAs, withFixtures } from "@/test/integration";
import { fetchAdminUserRecordById } from "./users";

describe("fetchAdminUserRecordById against local Supabase", () => {
  it("reads one user with their tier name and verifier, as an admin under RLS", () =>
    withFixtures(async (fixtures) => {
      // Its own tier: CI's database is unseeded.
      const { data: tier, error } = await fixtures.supabase
        .from("membership_types")
        .insert({
          name: `Integration tier ${fixtures.tag}`,
          slug: `integration-tier-${fixtures.tag}`,
          description: "Created by an integration test.",
          price: 10,
        })
        .select("id, name")
        .single();
      if (error) throw error;
      fixtures.track("membership_types", tier.id);

      const admin = await fixtures.createUser({ role_access: "admin" });
      const manager = await fixtures.createUser({ role_access: "manager", first_name: "Iris", last_name: "Chan" });
      const member = await fixtures.createUser({
        first_name: "Dora",
        membership_type_id: tier.id,
        student_verified_at: "2026-10-14T19:00:00Z",
        student_verified_by: manager.id,
      });

      const result = await fetchAdminUserRecordById(clientAs(admin), member.id);
      expect(result?.row).toMatchObject({ id: member.id, first_name: "Dora", membership_type_id: tier.id });
      expect(result?.row.membership_types).toEqual({ name: tier.name });
      expect(result?.verifier).toEqual({ id: manager.id, first_name: "Iris", last_name: "Chan" });

      // A user nobody verified has no verifier.
      expect((await fetchAdminUserRecordById(clientAs(admin), admin.id))?.verifier).toBeNull();
    }));

  it("drops a verifier whose account was deleted", () =>
    withFixtures(async (fixtures) => {
      const manager = await fixtures.createUser({ role_access: "manager" });
      const member = await fixtures.createUser({
        student_verified_at: "2026-10-14T19:00:00Z",
        student_verified_by: manager.id,
      });
      await fixtures.supabase.from("user_info").update({ deleted_at: new Date().toISOString() }).eq("id", manager.id).throwOnError();

      const result = await fetchAdminUserRecordById(fixtures.supabase, member.id);
      expect(result?.row.id).toBe(member.id);
      expect(result?.verifier).toBeNull();
    }));

  it("returns null for a deleted account, an unknown id and a malformed id", () =>
    withFixtures(async (fixtures) => {
      const gone = await fixtures.createUser();
      await fixtures.supabase.from("user_info").update({ deleted_at: new Date().toISOString() }).eq("id", gone.id).throwOnError();

      expect(await fetchAdminUserRecordById(fixtures.supabase, gone.id)).toBeNull();
      expect(await fetchAdminUserRecordById(fixtures.supabase, randomUUID())).toBeNull();
      // Postgres would reject it as a uuid; the helper answers "not found" instead.
      expect(await fetchAdminUserRecordById(fixtures.supabase, "not-a-uuid")).toBeNull();
    }));
});
