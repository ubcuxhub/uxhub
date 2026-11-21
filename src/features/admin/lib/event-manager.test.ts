import { describe, expect, it } from "vitest";

import { eventManagerHref, eventManagerTabs } from "./event-manager";

const ID = "event-id";

describe("eventManagerTabs", () => {
  it("links Overview, Check-in and Agenda for every event", () => {
    expect(eventManagerTabs(ID, { requires_application: false }, { applicationsToReview: 2 })).toEqual([
      { label: "Overview", href: "/admin/events/event-id/overview" },
      { label: "Check-in", href: "/admin/events/event-id/check-in" },
      { label: "Agenda", href: "/admin/events/event-id/agenda" },
    ]);
  });

  it("adds Applications, at the existing review URL, when the event takes them", () => {
    const tabs = eventManagerTabs(ID, { requires_application: true }, { applicationsToReview: 2 });
    expect(tabs.at(-1)).toEqual({
      label: "Applications",
      href: "/admin/events/event-id/review-applications",
      count: 2,
    });
  });

  it("drops a zero count", () => {
    const tabs = eventManagerTabs(ID, { requires_application: true }, { applicationsToReview: 0 });
    expect(tabs.at(-1)).toEqual({ label: "Applications", href: "/admin/events/event-id/review-applications" });
  });
});

describe("eventManagerHref", () => {
  it("lands on Overview", () => {
    expect(eventManagerHref(ID)).toBe("/admin/events/event-id/overview");
  });
});
