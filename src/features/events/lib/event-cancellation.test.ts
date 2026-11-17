import { describe, expect, it } from "vitest";

import { isCanceledEvent } from "./event-cancellation";

const now = new Date("2026-10-15T19:00:00Z");
const event = {
  canceled_at: "2026-10-14T19:00:00Z",
  starts_at: "2026-10-20T18:00:00Z",
  ends_at: "2026-10-20T20:00:00Z",
};

describe("isCanceledEvent", () => {
  it("is false for an event nobody canceled", () => {
    expect(isCanceledEvent({ ...event, canceled_at: null }, now)).toBe(false);
  });

  it("is true for a canceled event until it ends, its end included", () => {
    expect(isCanceledEvent(event, now)).toBe(true);
    expect(isCanceledEvent(event, new Date(event.ends_at))).toBe(true);
    expect(isCanceledEvent(event, new Date("2026-10-20T20:00:01Z"))).toBe(false);
  });

  it("ends an event without an end when it starts, and keeps an undated one canceled", () => {
    expect(isCanceledEvent({ ...event, ends_at: null }, new Date("2026-10-20T18:00:01Z"))).toBe(false);
    expect(isCanceledEvent({ ...event, starts_at: null, ends_at: null }, now)).toBe(true);
  });
});
