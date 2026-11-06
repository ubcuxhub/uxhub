// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
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
      agenda_enabled: true,
      description_images: [],
      created_at: null,
      description: "Event description",
      ends_at: null,
      event_colour: null,
      event_type: "regular",
      header_colour: null,
      header_image_url: null,
      image_url: null,
      is_featured: false,
      location_address: null,
      location_address_url: null,
      location_building: null,
      location_room: null,
      location_type: "in_person",
      marketing_url: null,
      mentors_enabled: false,
      publish_at,
      registration_closes_at: null,
      registration_opens_at: null,
      requires_application: false,
      short_description: null,
      slug: id,
      sponsors_enabled: false,
      max_team_size: null,
      min_team_size: null,
      team_deadline: null,
      teams_enabled: false,
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
  return within(screen.getByRole("table")).queryAllByRole("link").map((element) => element.textContent);
}
function count() {
  return document.querySelector("[data-slot=table-row-count] [role=status]")?.textContent;
}
function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), { target: { value } });
}
/** Opens the Sort and filter panel, unless it is open already. */
function openPanel() {
  const open = screen.queryByRole("dialog");
  if (open) return open;
  fireEvent.click(screen.getByRole("button", { name: /^Sort and filter/ }));
  return screen.getByRole("dialog");
}
function chooseSort(option: string) {
  const panel = openPanel();
  fireEvent.keyDown(within(panel).getByRole("combobox", { name: "Sort by" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
function toggleChip(name: string) {
  fireEvent.click(within(openPanel()).getByRole("button", { name }));
}

describe("AdminEventsTable", () => {
  it("lists events in the library table with the name first and pinned", () => {
    render(<AdminEventsTable rows={rows} />);
    expect(screen.getByRole("table").closest("[data-slot=table-card]")).not.toBeNull();
    expect(screen.getByRole("table").hasAttribute("data-sticky")).toBe(true);
    expect(screen.getAllByRole("columnheader").map((element) => element.textContent)).toEqual([
      "Name", "Date", "Status", "Registration", "Registered",
    ]);
    const workshop = screen.getByRole("link", { name: "Design Workshop" }).closest("tr")!;
    expect(within(workshop).getByText("Active")).toBeTruthy();
    expect(within(workshop).getByText("Open")).toBeTruthy();
    expect(workshop.textContent).toContain("7 / 30");
    // An undated event reads None, not a dash.
    const undated = screen.getByRole("link", { name: "Undated Meetup" }).closest("tr")!;
    expect(within(undated).getByText("None")).toBeTruthy();
    // No checkbox column: nothing to act on in bulk yet.
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("retains date ordering and leaves undated events last in both directions", () => {
    render(<AdminEventsTable rows={rows} />);
    expect(rowNames()).toEqual(["Draft Workshop", "Design Workshop", "Design Meetup", "Undated Meetup"]);
    chooseSort("Date, oldest first");
    expect(rowNames()).toEqual(["Design Meetup", "Design Workshop", "Draft Workshop", "Undated Meetup"]);
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();
  });

  it("combines trimmed name search with status and registration filters, including draft N/A", () => {
    render(<AdminEventsTable rows={rows} />);
    search(" WORKSHOP ");
    expect(rowNames()).toHaveLength(2);
    toggleChip("Draft");
    toggleChip("N/A");
    expect(rowNames()).toEqual(["Draft Workshop"]);
    expect(screen.getByRole("button", { name: "Sort and filter, 2 active" })).toBeTruthy();
    toggleChip("N/A");
    toggleChip("Open");
    expect(screen.getByText("No events match your search and filters.")).toBeTruthy();
    fireEvent.click(within(openPanel()).getByRole("button", { name: "Clear all" }));
    expect(rowNames()).toHaveLength(2);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(" WORKSHOP ");
  });

  it("matches any selected status while intersecting registration status", () => {
    render(<AdminEventsTable rows={rows} />);
    toggleChip("Active");
    toggleChip("Draft");
    toggleChip("Closed");
    expect(rowNames()).toEqual(["Design Meetup", "Undated Meetup"]);
  });

  it("links each event's name to its overview, which opens as a drawer over the list", () => {
    render(<AdminEventsTable rows={rows} />);
    const link = screen.getByRole("link", { name: "Design Workshop" });
    expect(link.getAttribute("href")).toBe("/admin/events/newer");
    expect(link.getAttribute("data-slot")).toBe("table-row-link");
    expect(link.hasAttribute("data-replace")).toBe(false);
    expect(document.querySelectorAll("[data-record-row]")).toHaveLength(4);
  });

  it("marks the open event's row and replaces rather than stacks records", () => {
    pathname = "/admin/events/newer";
    render(<AdminEventsTable rows={rows} />);
    const open = screen.getByRole("link", { name: "Design Workshop" });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.closest("tr")?.hasAttribute("data-active")).toBe(true);
    const other = screen.getByRole("link", { name: "Design Meetup" });
    expect(other.getAttribute("aria-current")).toBeNull();
    expect(other.hasAttribute("data-replace")).toBe(true);
  });

  it("shows a scheduled draft's publish date in its status", () => {
    render(<AdminEventsTable rows={[row("sched", "Scheduled Social", "2026-12-01T18:00:00+00:00", "draft", false, "2026-11-20T18:00:00+00:00")]} />);
    expect(screen.getByText("Scheduled Nov 20")).toBeTruthy();
  });
});

describe("Manage events pagination", () => {
  /** 27 events, a day apart, so the list has two pages. */
  const many = Array.from({ length: 27 }, (_, index) => {
    const n = String(index + 1).padStart(2, "0");
    return row(`e${n}`, `Event ${n}`, `2026-10-${n}T17:00:00.000Z`, "active", true);
  });

  it("shows 25 events a page, resets to page 1 on a search, and keeps the page when a record opens", () => {
    const { rerender } = render(<AdminEventsTable rows={many} />);
    expect(rowNames()).toHaveLength(25);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    // Newest first, so page 2 holds the two oldest.
    expect(rowNames()).toEqual(["Event 02", "Event 01"]);
    expect(count()).toBe("Showing 26–27 of 27 events");

    pathname = "/admin/events/e01";
    rerender(<AdminEventsTable rows={many} />);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();

    search("event");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(count()).toBe("Showing 1–25 of 27 events · filtered from 27");
  });

  it("opens on the page of the event in the URL", () => {
    pathname = "/admin/events/e02";
    render(<AdminEventsTable rows={many} />);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Event 02" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Manage events row count", () => {
  const rows = [
    row("1", "Spring Workshop", "2026-04-01T17:00:00.000Z", "active", true),
    row("2", "Draft Workshop", "2026-05-01T17:00:00.000Z", "draft", false),
    row("3", "Portfolio Night", "2026-06-01T17:00:00.000Z", "active", false),
  ];

  it("shows the range and total until a search or filter applies", () => {
    render(<AdminEventsTable rows={rows} />);
    expect(count()).toBe("Showing 1–3 of 3 events");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("says how many of all are shown, and Show all clears search and filters", () => {
    render(<AdminEventsTable rows={rows} />);
    search("workshop");
    expect(count()).toBe("Showing 1–2 of 2 events · filtered from 3");
    toggleChip("Draft");
    expect(count()).toBe("Showing 1 of 1 event · filtered from 3");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(count()).toBe("Showing 1–3 of 3 events");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Sort and filter" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});
