import { describe, expect, it } from "vitest";

import { eventNeedsAction, type NeedsActionInput } from "./event-needs-action";

const NOW = new Date("2026-11-21T20:00:00.000Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

function input(
  overrides: Omit<Partial<NeedsActionInput>, "event"> & { event?: Partial<NeedsActionInput["event"]> } = {}
): NeedsActionInput {
  const { event, ...rest } = overrides;
  return {
    event: {
      status: "active",
      requires_application: false,
      canceled_at: null,
      registration_opens_at: null,
      registration_closes_at: null,
      ...event,
    },
    applicationsToReview: 0,
    decisionsReleaseAt: null,
    paidTickets: 0,
    ...rest,
  };
}

describe("eventNeedsAction", () => {
  it("is empty when nothing needs action", () => {
    expect(eventNeedsAction(input(), NOW)).toEqual([]);
  });

  it("asks for a review while applications wait", () => {
    expect(
      eventNeedsAction(input({ event: { requires_application: true }, applicationsToReview: 4 }), NOW)
    ).toEqual([{ kind: "review", type: "todo", count: 4 }]);
  });

  it("ignores application counts on an event that takes none", () => {
    expect(eventNeedsAction(input({ applicationsToReview: 4, decisionsReleaseAt: inDays(2) }), NOW)).toEqual([]);
  });

  it("flags a decisions release within two weeks, but not one further off or past", () => {
    const event = { requires_application: true };
    expect(eventNeedsAction(input({ event, decisionsReleaseAt: inDays(14) }), NOW)).toEqual([
      { kind: "decisions-release", type: "deadline", at: inDays(14) },
    ]);
    expect(eventNeedsAction(input({ event, decisionsReleaseAt: inDays(15) }), NOW)).toEqual([]);
    expect(eventNeedsAction(input({ event, decisionsReleaseAt: inDays(-1) }), NOW)).toEqual([]);
  });

  it("flags open registration closing within a week", () => {
    expect(eventNeedsAction(input({ event: { registration_closes_at: inDays(3) } }), NOW)).toEqual([
      { kind: "registration-closes", type: "deadline", at: inDays(3) },
    ]);
    expect(eventNeedsAction(input({ event: { registration_closes_at: inDays(8) } }), NOW)).toEqual([]);
  });

  it("doesn't flag registration that isn't open: a draft, closed, or not open yet", () => {
    const closes = inDays(3);
    expect(eventNeedsAction(input({ event: { status: "draft", registration_closes_at: closes } }), NOW)).toEqual([]);
    expect(eventNeedsAction(input({ event: { registration_closes_at: inDays(-1) } }), NOW)).toEqual([]);
    expect(
      eventNeedsAction(input({ event: { registration_opens_at: inDays(1), registration_closes_at: closes } }), NOW)
    ).toEqual([]);
  });

  it("lists to-dos first, then deadlines soonest first", () => {
    const items = eventNeedsAction(
      input({
        event: { requires_application: true, registration_closes_at: inDays(5) },
        applicationsToReview: 2,
        decisionsReleaseAt: inDays(1),
      }),
      NOW
    );
    expect(items.map((item) => item.kind)).toEqual(["review", "decisions-release", "registration-closes"]);
  });

  it("asks only for refunds on a canceled event with paid tickets", () => {
    const canceled = {
      canceled_at: inDays(-1),
      requires_application: true,
      registration_closes_at: inDays(2),
    };
    expect(
      eventNeedsAction(input({ event: canceled, paidTickets: 5, applicationsToReview: 3, decisionsReleaseAt: inDays(2) }), NOW)
    ).toEqual([{ kind: "refund", type: "todo", count: 5 }]);
    expect(eventNeedsAction(input({ event: canceled, applicationsToReview: 3 }), NOW)).toEqual([]);
  });
});
