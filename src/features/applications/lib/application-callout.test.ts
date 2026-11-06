import { describe, expect, it } from "vitest";

import { applicationCallout } from "./application-callout";

const now = Date.parse("2026-11-06T12:00:00Z");
const open = {
  registration_opens_at: "2026-11-01T00:00:00Z",
  registration_closes_at: "2026-11-30T00:00:00Z",
};
const application = (status: "draft" | "submitted" | "accepted" | "rejected" | "waitlisted", offer: string | null = null) => ({
  status,
  offer_expires_at: offer,
});

describe("applicationCallout", () => {
  it("offers Apply while the window is open and there is no application", () => {
    expect(applicationCallout({ event: open, application: null, hasTicket: false, now })).toEqual({
      kind: "apply",
    });
  });

  it("says when applications are not open yet, or closed", () => {
    expect(
      applicationCallout({
        event: { registration_opens_at: "2026-12-01T00:00:00Z", registration_closes_at: null },
        application: null,
        hasTicket: false,
        now,
      })
    ).toEqual({ kind: "not_open" });
    expect(
      applicationCallout({
        event: { registration_opens_at: null, registration_closes_at: "2026-11-01T00:00:00Z" },
        application: null,
        hasTicket: false,
        now,
      })
    ).toEqual({ kind: "closed" });
  });

  it("continues a draft, unless the window closed on it", () => {
    expect(
      applicationCallout({ event: open, application: application("draft"), hasTicket: false, now })
    ).toEqual({ kind: "draft" });
    expect(
      applicationCallout({
        event: { ...open, registration_closes_at: "2026-11-05T00:00:00Z" },
        application: application("draft"),
        hasTicket: false,
        now,
      })
    ).toEqual({ kind: "draft_closed" });
  });

  it("shows each decision, whatever the window", () => {
    const closed = { registration_opens_at: null, registration_closes_at: "2026-11-01T00:00:00Z" };
    expect(applicationCallout({ event: closed, application: application("submitted"), hasTicket: false, now })).toEqual({ kind: "pending" });
    expect(applicationCallout({ event: closed, application: application("waitlisted"), hasTicket: false, now })).toEqual({ kind: "waitlisted" });
    expect(applicationCallout({ event: closed, application: application("rejected"), hasTicket: false, now })).toEqual({ kind: "not_selected" });
  });

  it("asks an accepted member to register until the offer expires", () => {
    expect(
      applicationCallout({
        event: open,
        application: application("accepted", "2026-11-10T00:00:00Z"),
        hasTicket: false,
        now,
      })
    ).toEqual({ kind: "accepted", offerExpiresAt: "2026-11-10T00:00:00Z" });
    expect(
      applicationCallout({
        event: open,
        application: application("accepted", "2026-11-05T00:00:00Z"),
        hasTicket: false,
        now,
      })
    ).toEqual({ kind: "offer_expired" });
  });

  it("shows nothing once the member holds a ticket", () => {
    expect(
      applicationCallout({
        event: open,
        application: application("accepted", "2026-11-10T00:00:00Z"),
        hasTicket: true,
        now,
      })
    ).toBeNull();
  });
});
