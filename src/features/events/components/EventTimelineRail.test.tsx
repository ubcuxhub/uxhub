// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { groupEventsByMonth } from "@/features/events/lib/event-timeline";
import type { EventRow } from "@/lib/supabase/models";

import { EventTimelineRail } from "./EventTimelineRail";

afterEach(cleanup);

const event = (
  slug: string,
  name: string,
  starts_at: string,
  extra: Partial<EventRow> = {},
) =>
  ({
    id: slug,
    slug,
    name,
    starts_at,
    ends_at: null,
    location_building: null,
    location_room: null,
    image_url: null,
    ...extra,
  }) as EventRow;

const EVENTS = [
  event("kickoff", "Kickoff", "2027-01-09T18:00:00Z", {
    location_building: "ICICS",
    location_room: "X150",
  }),
  event("workshop", "Figma Workshop", "2027-01-25T18:00:00Z"),
  event("mixer", "Spring Mixer", "2027-02-18T18:00:00Z"),
];

const noStatus = () => null;

describe("EventTimelineRail", () => {
  it("renders a heading per month with its events in a list", () => {
    render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={noStatus}
      />,
    );

    const months = screen.getAllByRole("heading", { level: 2 });
    expect(months).toHaveLength(2);

    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lists[1]).getAllByRole("listitem")).toHaveLength(1);
  });

  it("links each card to its portal event page by default", () => {
    render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={noStatus}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Kickoff" }).getAttribute("href"),
    ).toBe("/portal/events/kickoff");
  });

  it("takes the link from hrefFor when given", () => {
    render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={noStatus}
        hrefFor={() => "/dev/components"}
      />,
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toBe("/dev/components");
    }
  });

  it("joins building and room as the venue", () => {
    render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={noStatus}
      />,
    );
    expect(screen.getByText("ICICS X150")).toBeTruthy();
  });

  it("shows the badge statusFor returns, per event", () => {
    render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={(item) => (item.id === "workshop" ? "going" : null)}
      />,
    );
    expect(screen.getAllByText("Going")).toHaveLength(1);
    expect(document.querySelectorAll("[data-slot=badge]")).toHaveLength(1);
  });

  it("draws the rail on every row, ending the last row's line at the card", () => {
    const { container } = render(
      <EventTimelineRail
        groups={groupEventsByMonth(EVENTS)}
        statusFor={noStatus}
      />,
    );
    const lines = container.querySelectorAll("li [aria-hidden] > .border-dashed");
    expect(lines).toHaveLength(3);
    // Kickoff and Workshop bridge to the next row; Mixer is last in February.
    expect(lines[0].className).toContain("-bottom-6");
    expect(lines[1].className).toContain("bottom-0");
    expect(lines[1].className).not.toContain("-bottom-6");
    expect(lines[2].className).toContain("bottom-0");
  });

  it("renders nothing but an empty wrapper for no groups", () => {
    const { container } = render(
      <EventTimelineRail groups={[]} statusFor={noStatus} className="mb-8" />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.firstElementChild?.className).toContain("mb-8");
  });
});
