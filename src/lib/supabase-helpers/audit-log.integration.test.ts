/**
 * The history query against a real database.
 *
 * The unit tests stub the query builder, so they cannot tell whether PostgREST
 * resolves the `actor:actor_id (...)` embed, nor whether the filters and
 * ordering do what they claim. That only shows up here.
 *
 * Entries are inserted directly with the service-role key rather than produced
 * by editing a row: the trigger needs an actor set inside the write's own
 * transaction, which supabase-js cannot do. What the trigger writes is covered
 * by `supabase/tests/audit-events.sql`; this covers reading it back.
 */
import { describe, expect, it } from "vitest";

import {
  createIntegrationClient,
  withFixtures,
  type Fixtures,
} from "@/test/integration";

import {
  DELETED_ACTOR_NAME,
  fetchEventChangeHistory,
  fetchUserChangeHistory,
} from "./audit-log";

const supabase = createIntegrationClient();

async function addEntry(
  fixtures: Fixtures,
  entry: {
    actorId: string | null;
    subjectTable: string;
    subjectId: string;
    changes: unknown;
    createdAt?: string;
    source?: "admin_change" | "user_activity";
  }
) {
  const { data, error } = await supabase
    .from("audit_events")
    .insert({
      source: entry.source ?? "admin_change",
      action: `${entry.subjectTable}.updated`,
      actor_id: entry.actorId,
      subject_table: entry.subjectTable,
      subject_id: entry.subjectId,
      changes: entry.changes as never,
      ...(entry.createdAt ? { created_at: entry.createdAt } : {}),
    })
    .select("id")
    .single();

  if (error) throw error;
  fixtures.track("audit_events", data.id);
  return data.id;
}

describe("fetchChangeHistory against the database", () => {
  it("resolves the actor through the foreign key embed", async () => {
    await withFixtures(async (fixtures) => {
      const admin = await fixtures.createUser({ role_access: "admin" });
      const member = await fixtures.createUser();

      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "user_info",
        subjectId: member.id,
        changes: { major: { from: "Physics", to: "Design" } },
      });

      const history = await fetchUserChangeHistory(supabase, member.id);

      expect(history).toHaveLength(1);
      expect(history[0].actorName).toBe("Integration Test");
      expect(history[0].changes).toEqual([
        { column: "major", from: "Physics", to: "Design" },
      ]);
    });
  });

  it("returns a subject's entries newest first", async () => {
    await withFixtures(async (fixtures) => {
      const admin = await fixtures.createUser({ role_access: "admin" });
      const event = await fixtures.createEvent();

      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: event.id,
        changes: { name: { from: "a", to: "b" } },
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: event.id,
        changes: { name: { from: "b", to: "c" } },
        createdAt: "2026-02-01T00:00:00.000Z",
      });

      const history = await fetchEventChangeHistory(supabase, event.id);

      expect(history.map((entry) => entry.changes[0].to)).toEqual(["c", "b"]);
    });
  });

  it("does not mix in another subject, another table, or the activity feed", async () => {
    await withFixtures(async (fixtures) => {
      const admin = await fixtures.createUser({ role_access: "admin" });
      const event = await fixtures.createEvent();
      const otherEvent = await fixtures.createEvent({
        slug: `integration-event-${fixtures.tag}-other`,
      });
      const member = await fixtures.createUser();

      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: event.id,
        changes: { name: { from: "a", to: "mine" } },
      });
      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: otherEvent.id,
        changes: { name: { from: "a", to: "theirs" } },
      });
      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "user_info",
        subjectId: member.id,
        changes: { major: { from: "a", to: "elsewhere" } },
      });
      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: event.id,
        changes: null,
        source: "user_activity",
      });

      const history = await fetchEventChangeHistory(supabase, event.id);

      expect(history).toHaveLength(1);
      expect(history[0].changes[0].to).toBe("mine");
    });
  });

  it("shows a deleted actor as the deleted label, keeping the entry", async () => {
    await withFixtures(async (fixtures) => {
      const admin = await fixtures.createUser({ role_access: "admin" });
      const event = await fixtures.createEvent();

      await addEntry(fixtures, {
        actorId: admin.id,
        subjectTable: "events",
        subjectId: event.id,
        changes: { name: { from: "a", to: "b" } },
      });

      // What delete_account leaves behind.
      const { error } = await supabase
        .from("user_info")
        .update({
          first_name: "Deleted",
          last_name: "member",
          deleted_at: new Date().toISOString(),
        })
        .eq("id", admin.id);
      expect(error).toBeNull();

      const history = await fetchEventChangeHistory(supabase, event.id);

      expect(history).toHaveLength(1);
      expect(history[0].actorName).toBe(DELETED_ACTOR_NAME);
      // An admin deleting their account must not erase what they changed.
      expect(history[0].redacted).toBe(false);
      expect(history[0].changes).not.toEqual([]);
    });
  });

  it("honours the limit", async () => {
    await withFixtures(async (fixtures) => {
      const admin = await fixtures.createUser({ role_access: "admin" });
      const event = await fixtures.createEvent();

      for (const to of ["a", "b", "c"]) {
        await addEntry(fixtures, {
          actorId: admin.id,
          subjectTable: "events",
          subjectId: event.id,
          changes: { name: { from: "x", to } },
        });
      }

      await expect(
        fetchEventChangeHistory(supabase, event.id, { limit: 2 })
      ).resolves.toHaveLength(2);
    });
  });

  it("returns nothing for a row with no history", async () => {
    await withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent();

      await expect(
        fetchEventChangeHistory(supabase, event.id)
      ).resolves.toEqual([]);
    });
  });
});
