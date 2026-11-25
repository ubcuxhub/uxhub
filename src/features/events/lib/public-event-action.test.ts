import { describe, expect, it } from "vitest";

import type { EventState } from "./event-states";
import { publicEventActionFor } from "./public-event-action";

const DATE = "2026-12-01T18:00:00Z";

describe("publicEventActionFor", () => {
  it.each<[EventState, string, string]>([
    [{ kind: "reg-open", closesAt: DATE }, "checkout", "Register Now"],
    [{ kind: "app-open", closesAt: null }, "link", "Apply"],
    [{ kind: "app-draft", closesAt: null }, "link", "Continue Application"],
    [{ kind: "reg-going", ticketId: "t" }, "link", "View Your Ticket"],
    [{ kind: "reg-checked-in", ticketId: "t", checkedInAt: DATE }, "link", "View Your Ticket"],
    [{ kind: "app-accepted", offerExpiresAt: DATE }, "link", "Confirm Your Spot"],
    [{ kind: "app-in-review" }, "link", "View Your Application"],
    [{ kind: "app-waitlisted" }, "link", "View Your Application"],
    [{ kind: "app-rejected" }, "link", "View Your Application"],
    [{ kind: "app-offer-expired", offerExpiredAt: DATE, windowOpen: true }, "link", "View Your Application"],
    [{ kind: "canceled", note: null, ticketId: null }, "disabled", "Event Canceled"],
    [{ kind: "reg-past" }, "disabled", "Event Ended"],
    [{ kind: "reg-past-attended", ticketId: "t" }, "disabled", "Event Ended"],
    [{ kind: "reg-upcoming", opensAt: DATE }, "disabled", "Registration Opens Soon"],
    [{ kind: "app-upcoming", opensAt: DATE }, "disabled", "Applications Open Soon"],
    [{ kind: "reg-full" }, "disabled", "Event Full"],
    [{ kind: "reg-closed", closedAt: DATE }, "disabled", "Registration Closed"],
    [{ kind: "app-missed", closedAt: DATE }, "disabled", "Applications Closed"],
  ])("%o: %s %s", (state, kind, label) => {
    expect(publicEventActionFor(state, "sprint")).toMatchObject({ kind, label });
  });

  it("links into the event's own portal pages", () => {
    expect(publicEventActionFor({ kind: "reg-open", closesAt: null }, "sprint")).toMatchObject({ href: "/portal/events/sprint/checkout" });
    expect(publicEventActionFor({ kind: "app-draft", closesAt: null }, "sprint")).toMatchObject({ href: "/portal/events/sprint/apply" });
    expect(publicEventActionFor({ kind: "reg-going", ticketId: "t" }, "sprint")).toMatchObject({ href: "/portal/events/sprint" });
  });
});
