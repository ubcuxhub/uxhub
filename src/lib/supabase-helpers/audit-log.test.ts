import { describe, expect, it, vi } from "vitest";

import {
  DELETED_ACTOR_NAME,
  fetchChangeHistory,
  fetchEventChangeHistory,
  fetchUserChangeHistory,
} from "./audit-log";
import type { DbClient } from "./types";

/**
 * A query builder that records what was asked for and returns a fixed result.
 *
 * Every chained method returns the same object, so the helper's call order
 * does not matter and the assertions below read the recorded calls instead.
 */
function stubClient(result: { data?: unknown; error?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};

  for (const method of ["select", "eq", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return method === "limit"
        ? Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
        : builder;
    };
  }

  const from = vi.fn(() => builder);
  return { supabase: { from } as unknown as DbClient, from, calls };
}

const actor = {
  first_name: "Ada",
  last_name: "Admin",
  deleted_at: null,
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    created_at: "2026-11-04T10:00:00.000Z",
    action: "user_info.updated",
    changes: { major: { from: "Physics", to: "Design" } },
    actor,
    ...overrides,
  };
}

describe("fetchChangeHistory", () => {
  it("asks for one subject's admin changes, newest first", async () => {
    const { supabase, from, calls } = stubClient({ data: [] });

    await fetchChangeHistory(supabase, "user_info", "user-1");

    expect(from).toHaveBeenCalledWith("audit_events");
    expect(calls.filter((call) => call.method === "eq").map((call) => call.args))
      .toEqual([
        ["source", "admin_change"],
        ["subject_table", "user_info"],
        ["subject_id", "user-1"],
      ]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual([
      "created_at",
      { ascending: false },
    ]);
  });

  it("defaults to 50 entries and takes an override", async () => {
    const first = stubClient({ data: [] });
    await fetchChangeHistory(first.supabase, "events", "event-1");
    expect(first.calls.find((c) => c.method === "limit")?.args).toEqual([50]);

    const second = stubClient({ data: [] });
    await fetchChangeHistory(second.supabase, "events", "event-1", { limit: 5 });
    expect(second.calls.find((c) => c.method === "limit")?.args).toEqual([5]);
  });

  it("flattens the recorded diff into one entry per column", async () => {
    const { supabase } = stubClient({
      data: [
        row({
          changes: {
            major: { from: "Physics", to: "Design" },
            phone: { from: null, to: "604-555-0100" },
          },
        }),
      ],
    });

    const [entry] = await fetchChangeHistory(supabase, "user_info", "user-1");

    expect(entry).toMatchObject({
      id: "entry-1",
      createdAt: "2026-11-04T10:00:00.000Z",
      action: "user_info.updated",
      actorName: "Ada Admin",
      redacted: false,
    });
    // Sorted, because jsonb does not promise to return the keys in the order
    // the trigger wrote them.
    expect(entry.changes).toEqual([
      { column: "major", from: "Physics", to: "Design" },
      { column: "phone", from: null, to: "604-555-0100" },
    ]);
  });

  it("names a deleted actor rather than showing the anonymized profile", async () => {
    const { supabase } = stubClient({
      data: [
        row({
          actor: {
            // What delete_account leaves behind.
            first_name: "Deleted",
            last_name: "member",
            deleted_at: "2026-11-01T00:00:00.000Z",
          },
        }),
      ],
    });

    const [entry] = await fetchChangeHistory(supabase, "events", "event-1");

    expect(entry.actorName).toBe(DELETED_ACTOR_NAME);
  });

  it("leaves the actor null when the entry has none", async () => {
    const { supabase } = stubClient({ data: [row({ actor: null })] });

    const [entry] = await fetchChangeHistory(supabase, "events", "event-1");

    expect(entry.actorName).toBeNull();
  });

  it("falls back to the deleted label when a name is blank", async () => {
    const { supabase } = stubClient({
      data: [row({ actor: { first_name: " ", last_name: " ", deleted_at: null } })],
    });

    const [entry] = await fetchChangeHistory(supabase, "events", "event-1");

    expect(entry.actorName).toBe(DELETED_ACTOR_NAME);
  });

  it("reports a redacted entry with no values", async () => {
    const { supabase } = stubClient({
      data: [row({ changes: { redacted: true } })],
    });

    const [entry] = await fetchChangeHistory(supabase, "user_info", "user-1");

    // The entry stays, so the history still reads, but the scrubbed values
    // must not be rendered as a column diff.
    expect(entry.redacted).toBe(true);
    expect(entry.changes).toEqual([]);
  });

  it("copes with an entry that recorded no diff at all", async () => {
    const { supabase } = stubClient({ data: [row({ changes: null })] });

    const [entry] = await fetchChangeHistory(supabase, "user_info", "user-1");

    expect(entry.changes).toEqual([]);
    expect(entry.redacted).toBe(false);
  });

  it("returns an empty list when the reader cannot see the table", async () => {
    // RLS filters rows rather than raising, so a non-admin simply sees none.
    const { supabase } = stubClient({ data: [] });

    await expect(
      fetchChangeHistory(supabase, "user_info", "user-1")
    ).resolves.toEqual([]);
  });

  it("throws the database error", async () => {
    const failure = new Error("relation does not exist");
    const { supabase } = stubClient({ error: failure });

    await expect(
      fetchChangeHistory(supabase, "user_info", "user-1")
    ).rejects.toBe(failure);
  });
});

describe("the drawer wrappers", () => {
  it("scopes the user drawer to user_info", async () => {
    const { supabase, calls } = stubClient({ data: [] });

    await fetchUserChangeHistory(supabase, "user-1");

    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "subject_table",
      "user_info",
    ]);
  });

  it("scopes the event drawer to events", async () => {
    const { supabase, calls } = stubClient({ data: [] });

    await fetchEventChangeHistory(supabase, "event-1", { limit: 10 });

    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "subject_table",
      "events",
    ]);
    expect(calls.find((c) => c.method === "limit")?.args).toEqual([10]);
  });
});
