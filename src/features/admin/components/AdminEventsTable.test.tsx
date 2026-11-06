// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventStatus } from "@/lib/supabase/models";
import { AdminEventsTable, type AdminEventTableRow } from "./AdminEventsTable";

let pathname = "/admin/events";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({
    href,
    replace,
    children,
    ...props
  }: { href: string; replace?: boolean; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} data-replace={replace ? "" : undefined} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  pathname = "/admin/events";
});

function row(id: string, name: string, starts_at: string | null, status: EventStatus, registrationOpen: boolean, publish_at: string | null = null): AdminEventTableRow {
  return {
    event: {
      id, name, starts_at, status,
      max_capacity: 30,
      regular_price: 15,
      member_price: 5,
      agenda: null,
      description_images: [],
      created_at: null,
      description: "Event description",
      ends_at: null,
      event_type: "regular",
      image_url: null,
      location_address_url: null,
      location_building: null,
      location_room: null,
      mentors_enabled: false,
      publish_at,
      registration_closes_at: null,
      registration_opens_at: null,
      requires_application: false,
      short_description: null,
      slug: id,
      sponsors_enabled: false,
      updated_at: null,
    },
    registrationCount: 7,
    registrationOpen,
  };
}

const rows = [
  row("older", "Design Meetup", "2026-09-01T17:00:00+00:00", "active", false),
  row("newer", "Design Workshop", "2026-11-01T17:00:00+00:00", "active", true),
  row("draft", "Draft Workshop", "2026-12-01T18:00:00+00:00", "draft", true),
  row("undated", "Undated Meetup", null, "active", false),
];

function rowNames() {
  return screen.getAllByRole("link", { name: /^View details for/ }).map((element) => element.getAttribute("aria-label"));
}

describe("AdminEventsTable regression", () => {
  it("retains date ordering and leaves undated events last in both directions", () => {
    render(<AdminEventsTable rows={rows} />);
    expect(rowNames()).toEqual(["View details for Draft Workshop", "View details for Design Workshop", "View details for Design Meetup", "View details for Undated Meetup"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by date ascending" }));
    expect(rowNames()).toEqual(["View details for Design Meetup", "View details for Design Workshop", "View details for Draft Workshop", "View details for Undated Meetup"]);
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
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Closed" }));
    expect(rowNames()).toEqual(["View details for Design Meetup", "View details for Undated Meetup"]);
  });

  it("links each event's name to its overview, which opens as a drawer over the list", () => {
    render(<AdminEventsTable rows={rows} />);
    const link = screen.getByRole("link", { name: "View details for Design Workshop" });
    expect(link.getAttribute("href")).toBe("/admin/events/newer");
    expect(link.textContent).toBe("Design Workshop");
    expect(link.hasAttribute("data-replace")).toBe(false);
    // Rows are links now, not buttons that open a sheet in place.
    expect(screen.queryAllByRole("button", { name: /^View details for/ })).toEqual([]);
  });

  it("marks the open event's row and replaces rather than stacks records", () => {
    pathname = "/admin/events/newer";
    render(<AdminEventsTable rows={rows} />);
    const open = screen.getByRole("link", { name: "View details for Design Workshop" });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.closest("tr")?.hasAttribute("data-active")).toBe(true);
    const other = screen.getByRole("link", { name: "View details for Design Meetup" });
    expect(other.getAttribute("aria-current")).toBeNull();
    expect(other.hasAttribute("data-replace")).toBe(true);
  });

  it("shows a scheduled draft's publish date in its status", () => {
    render(<AdminEventsTable rows={[row("sched", "Scheduled Social", "2026-12-01T18:00:00+00:00", "draft", false, "2026-11-20T18:00:00+00:00")]} />);
    expect(screen.getByText("Scheduled Nov 20")).toBeTruthy();
  });
});
