// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventStatus } from "@/lib/supabase/models";
import { AdminEventsTable, type AdminEventTableRow } from "./AdminEventsTable";
import { buildAdminEventTableRows } from "../lib/admin-event-table";
import { defaultFormState } from "./event-form/event-form-schema";
import type { EventWorkingDocument } from "../lib/event-working-document";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function draft(id: string, event_id: string | null, name = "", starts_at = "") {
  const document: EventWorkingDocument = { version: 1, formState: { ...defaultFormState, name, starts_at }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
  return { id, event_id, document };
}

function row(id: string, name: string, starts_at: string | null, status: EventStatus, registrationOpen: boolean): AdminEventTableRow {
  return {
    event: {
      id, name, starts_at, status,
      max_capacity: 30,
      regular_price: 15,
      member_price: 5,
      configured_marketing_mode: null,
      configured_marketing_url: null,
      configured_price: null,
      configured_pricing_mode: null,
      configured_slug: null,
      configured_slug_edited: true,
      pricing_policy: "legacy",
      first_published_at: null,
      agenda: null,
      agenda_enabled: true,
      description_images: [],
      created_at: null,
      description_rich: null,
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
      publish_at: null,
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
  return screen.getAllByRole("button", { name: /^(View details|Resume draft) for/ }).map((element) => element.getAttribute("aria-label"));
}

describe("AdminEventsTable regression", () => {
  it("includes incomplete drafts in the existing table and filters without duplicating their source event", () => {
    const combined = buildAdminEventTableRows(rows, [draft("working", "draft", "Working Workshop", "2026-12-02T10:00"), draft("empty", null)]);
    render(<AdminEventsTable rows={combined} />);
    expect(rowNames()).toHaveLength(rows.length + 1);
    expect(screen.queryByRole("button", { name: "View details for Draft Workshop" })).toBeNull();
    const empty = screen.getByRole("button", { name: "Resume draft for Untitled event" });
    expect(within(empty).getByText("Draft")).toBeTruthy();
    expect(within(empty).getAllByText("—")).toHaveLength(2);
    expect(within(empty).getByText("N/A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "N/A" }));
    expect(rowNames()).toEqual(["Resume draft for Working Workshop", "Resume draft for Untitled event"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " working " } });
    expect(rowNames()).toEqual(["Resume draft for Working Workshop"]);
  });

  it.each(["click", "Enter", " "])("resumes standalone and existing-event drafts by %s", activation => {
    render(<AdminEventsTable rows={buildAdminEventTableRows([rows[2]], [draft("new-draft", null, "New work"), draft("existing-draft", "draft", "Existing work")])} />);
    for (const [name, href] of [["New work", "/admin/events/drafts/new-draft"], ["Existing work", "/admin/events/draft"]]) {
      const target = screen.getByRole("button", { name: `Resume draft for ${name}` });
      if (activation === "click") fireEvent.click(target);
      else fireEvent.keyDown(target, { key: activation });
      expect(push).toHaveBeenLastCalledWith(href);
      expect(screen.queryByRole("dialog")).toBeNull();
    }
  });

  it("sorts draft dates with event dates, keeping missing dates last in either direction", () => {
    render(<AdminEventsTable rows={buildAdminEventTableRows([rows[0]], [draft("dated", null, "Earlier draft", "2026-08-01T10:00"), draft("undated-draft", null)])} />);
    expect(rowNames()).toEqual(["View details for Design Meetup", "Resume draft for Earlier draft", "Resume draft for Untitled event"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by date ascending" }));
    expect(rowNames()).toEqual(["Resume draft for Earlier draft", "View details for Design Meetup", "Resume draft for Untitled event"]);
  });

  it("keeps published and scheduled events visible if an obsolete working document remains", () => {
    const scheduled = { ...rows[2], event: { ...rows[2].event, publish_at: "2026-12-01T17:00:00Z" } };
    expect(buildAdminEventTableRows([rows[0], scheduled], [draft("old-live", "older", "Outdated live"), draft("old-scheduled", "draft", "Outdated schedule")])).toEqual([rows[0], scheduled]);
  });

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
