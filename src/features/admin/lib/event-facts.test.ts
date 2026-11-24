import { describe, expect, it } from "vitest";

import { describeEventPrice, eventHasEnded } from "./event-facts";

describe("eventHasEnded", () => {
  const end = "2026-11-15T20:00:00Z";

  it("ends at the end instant, as event_has_ended's <= does", () => {
    expect(eventHasEnded({ status: "active", starts_at: null, ends_at: end }, new Date(end))).toBe(true);
    expect(eventHasEnded({ status: "active", starts_at: null, ends_at: end }, Date.parse(end) - 1)).toBe(false);
  });

  it("falls back to the start, and never ends a draft or an undated event", () => {
    expect(eventHasEnded({ status: "active", starts_at: end, ends_at: null }, new Date(end))).toBe(true);
    expect(eventHasEnded({ status: "draft", starts_at: null, ends_at: end }, new Date(end))).toBe(false);
    expect(eventHasEnded({ status: "active", starts_at: null, ends_at: null }, new Date(end))).toBe(false);
  });
});

describe("describeEventPrice", () => {
  it.each([
    [{ regular_price: null, member_price: null }, "Not set"],
    [{ regular_price: 0, member_price: 0 }, "Free"],
    [{ regular_price: 15, member_price: null }, "$15.00"],
    [{ regular_price: 15, member_price: 15 }, "$15.00"],
    [{ regular_price: 15, member_price: 0 }, "$15.00 · Free for members"],
    [{ regular_price: 15, member_price: 10 }, "$15.00 · $10.00 for members"],
  ])("describes %j as %s", (prices, expected) => {
    expect(describeEventPrice(prices)).toBe(expected);
  });
});
