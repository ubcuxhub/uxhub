// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { EventStatus } from "@/lib/supabase/models";
import { AdminEventsTable, type AdminEventTableRow } from "./AdminEventsTable";

afterEach(cleanup);

function row(id: string, name: string, start_date: string | null, status: EventStatus, registrationOpen: boolean): AdminEventTableRow {
  return {
    event: {
      id, name, start_date, status,
      max_capacity: 30,
      regular_price: 15,
      member_price: 5,
      agenda: null,
      description_images: [],
      applications_enabled: false,
      created_at: null,
      description: "Event description",
      end_date: null,
      end_time: null,
      event_type: "regular",
      image_url: null,
      location_address_url: null,
      location_building: null,
      location_room: null,
      mentors_enabled: false,
      registration_end_time: null,
      registration_start_time: null,
      short_description: null,
      slug: id,
      sponsors_enabled: false,
      start_time: null,
      updated_at: null,
    },
    registrationCount: 7,
    registrationOpen,
  };
}

const rows = [
  row("older", "Design Meetup", "2026-09-01", "active", false),
  row("newer", "Design Workshop", "2026-11-01", "active", true),
  row("draft", "Draft Workshop", "2026-12-01", "draft", true),
  row("undated", "Archived Meetup", null, "archived", false),
];

function rowNames() {
  return screen.getAllByRole("button", { name: /^View details for/ }).map((element) => element.getAttribute("aria-label"));
}

describe("AdminEventsTable regression", () => {
  it("retains date ordering and leaves undated events last in both directions", () => {
    render(<AdminEventsTable rows={rows} />);
    expect(rowNames()).toEqual(["View details for Draft Workshop", "View details for Design Workshop", "View details for Design Meetup", "View details for Archived Meetup"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by date ascending" }));
    expect(rowNames()).toEqual(["View details for Design Meetup", "View details for Design Workshop", "View details for Draft Workshop", "View details for Archived Meetup"]);
  });

  it("combines trimmed name search with status and registration filters, including draft N/A", () => {
    render(<AdminEventsTable rows={rows} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " WORKSHOP " } });
    expect(rowNames()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "N/A" }));
    expect(rowNames()).toEqual(["View details for Draft Workshop"]);
    expect(screen.getByRole("button", { name: "Filters 2" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "N/A" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Open" }));
    expect(screen.getByText("No events match your search and filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(2);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(" WORKSHOP ");
  });

  it("matches any selected status while intersecting registration status", () => {
    render(<AdminEventsTable rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Archived" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Closed" }));
    expect(rowNames()).toEqual(["View details for Design Meetup", "View details for Archived Meetup"]);
  });

  it.each(["click", "Enter", " "])("opens the existing sheet by %s with the same management links", (activation) => {
    render(<AdminEventsTable rows={rows} />);
    const target = screen.getByRole("button", { name: "View details for Design Workshop" });
    if (activation === "click") fireEvent.click(target);
    else fireEvent.keyDown(target, { key: activation });
    const sheet = screen.getByRole("dialog", { name: "Design Workshop" });
    expect(within(sheet).getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/admin/events/newer");
    expect(within(sheet).getByRole("link", { name: "Check-In" }).getAttribute("href")).toBe("/admin/events/newer/check-in");
    expect(within(sheet).getByRole("link", { name: "Apps" }).getAttribute("href")).toBe("/admin/events/newer/review-applications");
  });
});
