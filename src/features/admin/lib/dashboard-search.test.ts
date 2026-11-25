import { describe, expect, it } from "vitest";
import { addRecentReference, matchingActions, parseRecentReferences, searchDestination } from "./dashboard-search";
describe("dashboard search model", () => {
  it("maps existing destinations and searches action labels", () => {
    expect(searchDestination({ kind: "user", id: "a" })).toBe("/admin/users/a");
    expect(searchDestination({ kind: "event", id: "b" })).toBe("/admin/events/b");
    expect(searchDestination({ kind: "application", id: "c" })).toBe("/admin/events/c/review-applications");
    expect(searchDestination({ kind: "action", id: "statistics" })).toBeNull();
    expect(matchingActions("  STATISTICS ").map((item) => item.id)).toEqual(["statistics"]);
  });
  it("bounds/deduplicates reference history and rejects untrusted stored data", () => {
    const ref = { kind: "user", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" } as const;
    expect(parseRecentReferences([null, {}, { kind: "action", id: "unknown" }, { kind: "user", id: "../../bad" }, { ...ref, label: "Untrusted name" }])).toEqual([ref]);
    expect(parseRecentReferences("invalid")).toEqual([]);
    expect(parseRecentReferences([{ kind: "action", id: "export" }])).toEqual([{ kind: "action", id: "export" }]);
    expect(addRecentReference([ref, { kind: "action", id: "statistics" }], ref)).toEqual([ref, { kind: "action", id: "statistics" }]);
    expect(addRecentReference(Array.from({ length: 8 }, (_, i) => ({ kind: "event", id: String(i) })), ref)).toHaveLength(5);
  });
});
