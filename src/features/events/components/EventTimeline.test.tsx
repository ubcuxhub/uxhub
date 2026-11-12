// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/supabase/models";

import { EventTimeline } from "./EventTimeline";

afterEach(cleanup);

const event = (slug: string, name: string, starts_at: string, extra: Partial<EventRow> = {}) =>
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

const UPCOMING = [
  event("kickoff", "Kickoff", "2027-01-09T18:00:00Z", { location_building: "ICICS" }),
  event("workshop", "Figma Workshop", "2027-01-25T18:00:00Z"),
  event("cafe", "Café Chat", "2027-02-18T18:00:00Z"),
];
const PAST = [event("mixer", "Spring Mixer", "2026-03-18T18:00:00Z")];

const search = () => screen.getByRole("searchbox", { name: "Search events" }) as HTMLInputElement;
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });
const status = () => screen.queryByRole("status")?.textContent ?? null;

describe("EventTimeline", () => {
  it("lists upcoming events, and past ones behind the switch", () => {
    render(<EventTimeline upcomingEvents={UPCOMING} pastEvents={PAST} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);

    fireEvent.click(screen.getByRole("switch", { name: "Show past events" }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Spring Mixer"]);
  });

  it("shows each event's badge, including dated ones", () => {
    render(
      <EventTimeline
        upcomingEvents={UPCOMING}
        pastEvents={PAST}
        badges={{
          kickoff: { status: "going" },
          workshop: { status: "opens", date: "Jan 12" },
        }}
      />
    );
    expect(screen.getByText("Going")).toBeTruthy();
    expect(screen.getByText("Opens Jan 12")).toBeTruthy();
    // Café Chat has no badge, and an upcoming event never falls back to Past.
    expect(document.querySelectorAll("[data-slot='badge']")).toHaveLength(2);
  });

  it("shows a past event's own badge, and Past without one", () => {
    const past = [...PAST, event("talk", "Design Talk", "2026-02-10T18:00:00Z")];
    render(
      <EventTimeline
        upcomingEvents={UPCOMING}
        pastEvents={past}
        badges={{ mixer: { status: "checked_in" } }}
      />
    );
    fireEvent.click(screen.getByRole("switch", { name: "Show past events" }));
    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.getByText("Past")).toBeTruthy();
  });

  it("announces nothing until there is a query", () => {
    render(<EventTimeline upcomingEvents={UPCOMING} pastEvents={PAST} />);
    expect(status()).toBeNull();
  });

  it.each([
    ["figma", 1, "1 result"],
    ["  KICKOFF ", 1, "1 result"],
    ["icics", 1, "1 result"],
    ["cafe", 1, "1 result"],
    ["o", 2, "2 results"],
    ["nothing here", 0, "No results"],
  ])("filters by %j and announces the count", (query, count, announced) => {
    render(<EventTimeline upcomingEvents={UPCOMING} pastEvents={PAST} />);
    type(query);
    expect(screen.queryAllByRole("link")).toHaveLength(count);
    expect(status()).toBe(announced);
  });

  it("offers a way out when nothing matches", () => {
    render(<EventTimeline upcomingEvents={UPCOMING} pastEvents={PAST} />);
    type("zzz");

    expect(screen.getByRole("heading", { name: "No events match “zzz”" })).toBeTruthy();
    const clear = screen.getAllByRole("button", { name: "Clear search" });
    // One in the field, one in the empty state.
    expect(clear).toHaveLength(2);

    fireEvent.click(clear[1]);
    expect(search().value).toBe("");
    expect(document.activeElement).toBe(search());
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it.each([
    [false, "No events scheduled yet"],
    [true, "No past events"],
  ])("says so when there are no events (past: %s), with no clear action", (past, title) => {
    render(<EventTimeline upcomingEvents={[]} pastEvents={[]} />);
    if (past) fireEvent.click(screen.getByRole("switch", { name: "Show past events" }));
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});
