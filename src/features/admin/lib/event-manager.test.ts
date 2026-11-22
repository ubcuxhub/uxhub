import { describe, expect, it } from "vitest";

import { eventManagerHref, eventManagerTabs } from "./event-manager";

const ID = "event-id";

describe("eventManagerTabs", () => {
  it("links Overview, Agenda and Check-in for every event", () => {
    expect(
      eventManagerTabs(ID, { requires_application: false, teams_enabled: false }, { applicationsToReview: 2 })
    ).toEqual([
      { label: "Overview", href: "/admin/events/event-id/overview" },
      { label: "Agenda", href: "/admin/events/event-id/agenda" },
      { label: "Check-in", href: "/admin/events/event-id/check-in" },
    ]);
  });

  it("adds Teams only for an event with teams, before Applications", () => {
    const tabs = eventManagerTabs(ID, { requires_application: true, teams_enabled: true }, { applicationsToReview: 0 });
    expect(tabs.map((tab) => tab.label)).toEqual(["Overview", "Agenda", "Check-in", "Teams", "Applications"]);
    expect(tabs[3].href).toBe("/admin/events/event-id/teams");
  });

  it("adds Applications, at the existing review URL, when the event takes them", () => {
    const tabs = eventManagerTabs(ID, { requires_application: true, teams_enabled: false }, { applicationsToReview: 2 });
    expect(tabs.at(-1)).toEqual({
      label: "Applications",
      href: "/admin/events/event-id/review-applications",
      count: 2,
    });
  });

  it("drops a zero count", () => {
    const tabs = eventManagerTabs(ID, { requires_application: true, teams_enabled: false }, { applicationsToReview: 0 });
    expect(tabs.at(-1)).toEqual({ label: "Applications", href: "/admin/events/event-id/review-applications" });
  });
});

describe("eventManagerHref", () => {
  it("lands on Overview", () => {
    expect(eventManagerHref(ID)).toBe("/admin/events/event-id/overview");
  });
});
