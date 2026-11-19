import { expect, it } from "vitest";
import { selectedCheckInItem, checkInPath, checkInReturnTo, type CheckInItem } from "./item-check-in";
const items: CheckInItem[] = [{ id: "a", label: "A", starts_at: "2026-11-01T07:00:00Z", ends_at: "2026-11-01T11:00:00Z" }, { id: "b", label: "B", starts_at: "2026-11-08T18:00:00Z", ends_at: "2026-11-08T19:00:00Z" }];
it.each([["2026-10-01", "a"], ["2026-11-01T09:30:00Z", "a"], ["2026-11-05", "b"], ["2027-01-01", "b"]])("defaults before, overnight/DST, between days and after the event", (at, id) => expect(selectedCheckInItem(items, undefined, new Date(at))).toBe(id));
it("preserves explicit selection and never substitutes for invalid links", () => {
  expect(selectedCheckInItem(items, "b", new Date("2026-10-01"))).toBe("b");
  expect(selectedCheckInItem(items, "foreign", new Date())).toBeNull();
  expect(selectedCheckInItem([], undefined, new Date())).toBeNull();
  expect(checkInPath("event", "b", true)).toBe("/admin/events/event/check-in/scan?item=b");
  expect(checkInPath("event", "b")).toBe("/admin/events/event/check-in?item=b");
});

it.each([undefined, "https://evil.test/path", "//evil.test", "/\\evil.test", "/%2fevil.test", "/%5cevil.test", "/%0a/evil.test", "/%", "/path/..//evil.test", "/%2e%2e//evil.test", "/admin/events/e/check-in"])('rejects unsafe return destinations: %s', value => {
  expect(checkInReturnTo(value)).toBe("/admin/events");
});
it("preserves a root-relative destination through item switches and scanner round trips", () => {
  const returnTo = "/admin/events/event/agenda?day=second";
  let path = checkInPath("event", "a", false, returnTo);
  for (const scan of [true, false]) {
    const query = new URL(path, "https://internal.invalid").searchParams;
    path = checkInPath("event", "b", scan, query.get("returnTo")!);
    expect(new URL(path, "https://internal.invalid").searchParams.get("returnTo")).toBe(returnTo);
  }
});
