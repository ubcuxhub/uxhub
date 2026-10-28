import { describe, expect, it } from "vitest";

import {
  buildApplicationDecisionUpdate,
  getApplicationDecisions,
  getApplicationReviewState,
} from "./application-review";

const now = new Date("2026-10-20T12:00:00.000Z");

describe("getApplicationReviewState", () => {
  it("shows undecided and final statuses as they are", () => {
    for (const status of ["submitted", "waitlisted", "rejected"] as const) {
      expect(
        getApplicationReviewState({ status, offer_expires_at: null }, false, now)
      ).toBe(status);
    }
  });

  it("splits an acceptance by its ticket and deadline", () => {
    const open = { status: "accepted" as const, offer_expires_at: "2026-10-21T00:00:00.000Z" };
    const lapsed = { status: "accepted" as const, offer_expires_at: "2026-10-20T11:59:59.000Z" };

    expect(getApplicationReviewState(open, false, now)).toBe("accepted");
    expect(getApplicationReviewState(lapsed, false, now)).toBe("offer_expired");
    expect(getApplicationReviewState(lapsed, true, now)).toBe("registered");
  });
});

describe("getApplicationDecisions", () => {
  it("follows the moves the database allows", () => {
    expect(getApplicationDecisions("submitted")).toEqual(["accept", "waitlist", "reject"]);
    expect(getApplicationDecisions("waitlisted")).toEqual(["accept", "reject"]);
    expect(getApplicationDecisions("offer_expired")).toEqual(["accept", "reject"]);
    expect(getApplicationDecisions("registered")).toEqual([]);
    expect(getApplicationDecisions("rejected")).toEqual([]);
  });
});

describe("buildApplicationDecisionUpdate", () => {
  it("requires a future deadline to accept", () => {
    expect(buildApplicationDecisionUpdate("accept", null, now).ok).toBe(false);
    expect(buildApplicationDecisionUpdate("accept", "2026-10-21T00:00", now).ok).toBe(false);
    expect(
      buildApplicationDecisionUpdate("accept", "2026-10-20T11:00:00.000Z", now).ok
    ).toBe(false);
    expect(
      buildApplicationDecisionUpdate("accept", "2026-10-21T00:00:00.000Z", now)
    ).toEqual({
      ok: true,
      update: { status: "accepted", offer_expires_at: "2026-10-21T00:00:00.000Z" },
    });
  });

  it("clears the deadline for any other decision", () => {
    expect(
      buildApplicationDecisionUpdate("reject", "2026-10-21T00:00:00.000Z", now)
    ).toEqual({ ok: true, update: { status: "rejected", offer_expires_at: null } });
    expect(buildApplicationDecisionUpdate("waitlist", null, now)).toEqual({
      ok: true,
      update: { status: "waitlisted", offer_expires_at: null },
    });
  });

  it("rejects an unknown decision", () => {
    expect(
      buildApplicationDecisionUpdate("approve" as never, null, now).ok
    ).toBe(false);
  });
});
