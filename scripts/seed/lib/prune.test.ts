import { describe, expect, it } from "vitest";

import { describeSkippedPrune, planPrune, pruneKey } from "./prune.ts";

describe("planPrune", () => {
  it("keeps rows the seed data still describes and removes the rest", () => {
    const existing = [
      { id: "a", slug: "uxathon-upcoming" },
      { id: "b", slug: "invented-by-hand" },
      { id: "c", slug: "student-panel" },
    ];

    const plan = planPrune(existing, (row) => row.slug, [
      "uxathon-upcoming",
      "student-panel",
      "not-in-the-database-yet",
    ]);

    expect(plan.keep.map((row) => row.id)).toEqual(["a", "c"]);
    expect(plan.remove).toEqual([
      { key: "invented-by-hand", row: { id: "b", slug: "invented-by-hand" } },
    ]);
  });

  it("keeps rows whose key cannot be resolved", () => {
    // An unkeyable row is one the seed cannot prove it owns, so it survives.
    const existing = [{ id: "a", slug: null }, { id: "b", slug: undefined }];

    const plan = planPrune(existing, (row) => row.slug, ["anything"]);

    expect(plan.remove).toEqual([]);
    expect(plan.keep).toHaveLength(2);
  });

  it("removes everything when the seed data is empty", () => {
    const plan = planPrune([{ key: "x" }], (row) => row.key, []);

    expect(plan.keep).toEqual([]);
    expect(plan.remove.map((entry) => entry.key)).toEqual(["x"]);
  });

  it("keeps everything when nothing has drifted", () => {
    const existing = [{ key: "one" }, { key: "two" }];

    const plan = planPrune(existing, (row) => row.key, ["one", "two"]);

    expect(plan.remove).toEqual([]);
    expect(plan.keep).toEqual(existing);
  });

  it("matches composite keys built with pruneKey", () => {
    const existing = [
      { user: "u1", event: "e1" },
      { user: "u1", event: "e2" },
    ];

    const plan = planPrune(
      existing,
      (row) => pruneKey(row.user, row.event),
      [pruneKey("u1", "e1")]
    );

    expect(plan.remove.map((entry) => entry.key)).toEqual([pruneKey("u1", "e2")]);
  });
});

describe("describeSkippedPrune", () => {
  it("lists the keys it could not delete", () => {
    expect(describeSkippedPrune("events", ["a", "b"])).toBe(
      "  ! events: 2 row(s) not in the seed data left in place (a, b)"
    );
  });

  it("truncates a long list", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"];

    expect(describeSkippedPrune("mentors", keys)).toBe(
      "  ! mentors: 7 row(s) not in the seed data left in place (a, b, c, d, e, and 2 more)"
    );
  });
});
