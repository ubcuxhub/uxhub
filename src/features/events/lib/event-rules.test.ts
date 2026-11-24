import { describe, expect, it } from "vitest";

import { eventEndsAt, eventPriceFor, hasEventEnded } from "./event-rules";

describe("eventEndsAt and hasEventEnded", () => {
  const event = { starts_at: "2026-11-07T03:00:00Z", ends_at: "2026-11-07T09:00:00Z" };

  it("ends at ends_at, or at starts_at without one", () => {
    expect(eventEndsAt(event)).toBe(event.ends_at);
    expect(eventEndsAt({ ...event, ends_at: null })).toBe(event.starts_at);
    expect(eventEndsAt({ starts_at: null, ends_at: null })).toBeNull();
  });

  it("counts the end instant as still running", () => {
    expect(hasEventEnded(event, new Date(event.ends_at))).toBe(false);
    expect(hasEventEnded(event, new Date(Date.parse(event.ends_at) + 1))).toBe(true);
    expect(hasEventEnded({ ...event, ends_at: null }, new Date("2026-11-07T04:00:00Z"))).toBe(true);
  });

  it("never ends an undated event", () => {
    expect(hasEventEnded({ starts_at: null, ends_at: null }, new Date("2100-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("eventPriceFor", () => {
  const event = { pricing_policy: "figma", member_price: 0, regular_price: 20 } as const;
  const member = { membership_type_id: "tier", membership_expires_at: "2099-01-01T00:00:00Z" };

  it("gives an active member the member price", () => {
    expect(eventPriceFor(event, member, null)).toEqual({ amount: 0, isMember: true });
  });

  it("charges the regular price once the membership or the club term has ended", () => {
    expect(eventPriceFor(event, { ...member, membership_expires_at: "2000-01-01T00:00:00Z" }, null))
      .toEqual({ amount: 20, isMember: false });
    expect(eventPriceFor(event, member, "2000-01-01T00:00:00Z")).toEqual({ amount: 20, isMember: false });
  });

  it("gives any tier the member price under legacy pricing", () => {
    const legacy = { ...event, pricing_policy: "legacy" } as const;
    expect(eventPriceFor(legacy, { ...member, membership_expires_at: "2000-01-01T00:00:00Z" }, null))
      .toEqual({ amount: 0, isMember: true });
    expect(eventPriceFor(legacy, { membership_type_id: null, membership_expires_at: null }, null))
      .toEqual({ amount: 20, isMember: false });
  });

  it("leaves the amount empty until pricing is configured", () => {
    expect(eventPriceFor({ ...event, regular_price: null }, { membership_type_id: null, membership_expires_at: null }, null).amount).toBeNull();
  });
});
