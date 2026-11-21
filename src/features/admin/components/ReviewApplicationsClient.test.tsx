// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewListItem } from "../lib/application-review";
import { ReviewApplicationsClient } from "./ReviewApplicationsClient";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
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
beforeEach(() => window.history.replaceState(null, "", "/admin/events/e1/review-applications"));
afterEach(cleanup);

// 1-26 submitted, 27 waitlisted, 28 accepted, 29 rejected, 30 going.
const items: ReviewListItem[] = Array.from({ length: 30 }, (_, index) => {
  const n = String(index + 1).padStart(2, "0");
  return {
    applicationId: `app-${n}`,
    name: `Applicant ${n}`,
    email: `applicant${n}@example.com`,
    program: "Design",
    year: "2",
    studentStatus: "undergraduate",
    membership: index % 2 ? "explorer" : null,
    appliedAt: `2026-10-${n}T18:00:00Z`,
    state:
      index < 26
        ? "submitted"
        : (["waitlisted", "accepted", "rejected", "registered"] as const)[index - 26],
    offerExpiresAt: null,
  };
});

function renderList(applications = items) {
  return render(
    <ReviewApplicationsClient
      eventId="e1"
      eventName="UXathon"
      subtitle="Applications closed Nov 3"
      capacity={60}
      applications={applications}
    />,
  );
}
const rowLinks = () => within(screen.getByRole("table")).queryAllByRole("link");
const chip = (label: RegExp) => screen.getByRole("button", { name: label });

describe("ReviewApplicationsClient", () => {
  it("opens on Submitted, with counts, 25 to a page, oldest first", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1, name: "Applications" })).toBeTruthy();
    expect(screen.getByText("UXathon · Applications closed Nov 3")).toBeTruthy();
    expect(chip(/^Submitted/).getAttribute("aria-pressed")).toBe("true");
    expect(chip(/^Submitted/).textContent).toContain("26");
    expect(chip(/^Rejected/).textContent).toContain("1");
    expect(rowLinks()).toHaveLength(25);
    expect(rowLinks()[0].textContent).toBe("Applicant 01");
    expect(screen.getByText(/Showing 1–25 of 26 applicants · filtered from 30/)).toBeTruthy();
  });

  it("keeps the view in the URL and carries it on row links", () => {
    renderList();
    fireEvent.click(chip(/^Waitlisted/));
    expect(window.location.search).toBe("?status=submitted%2Cwaitlisted");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search applicants" }), {
      target: { value: "nobody" },
    });
    expect(window.location.search).toBe("?status=submitted%2Cwaitlisted&q=nobody");
    expect(rowLinks()).toHaveLength(0);
    expect(screen.getByText("No applicants match your search and filters.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(window.location.search).toBe("?status=all");
    expect(rowLinks()).toHaveLength(25);
    expect(rowLinks()[0].getAttribute("href")).toBe(
      "/admin/events/e1/review-applications/app-01?status=all",
    );
  });

  it("pages in the URL", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(window.location.search).toBe("?page=2");
    expect(rowLinks().map((link) => link.textContent)).toEqual(["Applicant 26"]);
    expect(rowLinks()[0].getAttribute("href")).toContain("?page=2");
  });

  it("reads the view from the URL and highlights and focuses the row you came from", () => {
    window.history.replaceState(
      null,
      "",
      "/admin/events/e1/review-applications?status=all&sort=name&page=2&from=app-28",
    );
    renderList();
    const current = rowLinks().find((link) => link.getAttribute("aria-current"));
    expect(current?.textContent).toBe("Applicant 28");
    expect(document.activeElement).toBe(current);
    // The highlight is for arrival only: row links don't carry it on.
    expect(current?.getAttribute("href")).not.toContain("from=");
  });

  it("drops the highlight once the view changes", () => {
    window.history.replaceState(null, "", "/admin/events/e1/review-applications?status=all&from=app-03");
    renderList();
    fireEvent.click(chip(/^Rejected/));
    expect(window.location.search).not.toContain("from=");
    expect(rowLinks().some((link) => link.getAttribute("aria-current"))).toBe(false);
  });

  it("sorts newest first", () => {
    window.history.replaceState(null, "", "/admin/events/e1/review-applications?sort=newest");
    renderList();
    expect(rowLinks()[0].textContent).toBe("Applicant 26");
  });

  it("filters from the panel, keeps the filters in the URL, and clears them", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Sort and filter" }));
    const panel = screen.getByRole("dialog", { name: "Sort and filter" });
    // The fieldset and its chip group share the name.
    const group = (name: string) => within(panel).getAllByRole("group", { name })[0];
    const membership = group("Membership");
    // Tiers applicants hold, then Non-member; Program options come from the data.
    expect(within(membership).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Explorer",
      "Non-member",
    ]);
    expect(
      within(group("Program")).getAllByRole("button").map((b) => b.textContent)
    ).toEqual(["Design"]);

    fireEvent.click(within(membership).getByRole("button", { name: "Explorer" }));
    expect(window.location.search).toBe("?membership=explorer");
    // Even-numbered applicants are Explorers: 13 of the 26 submitted.
    expect(rowLinks()).toHaveLength(13);
    expect(rowLinks()[0].getAttribute("href")).toBe(
      "/admin/events/e1/review-applications/app-02?membership=explorer",
    );
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Clear all" }));
    expect(window.location.search).toBe("");
    expect(rowLinks()).toHaveLength(25);
  });

  it("sorts by name, Z to A", () => {
    window.history.replaceState(null, "", "/admin/events/e1/review-applications?sort=name-desc");
    renderList();
    expect(rowLinks()[0].textContent).toBe("Applicant 26");
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();
  });

  it("hides the Notes column until counts are provided", () => {
    const { unmount } = renderList();
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();
    unmount();
    renderList(items.map((item, index) => ({ ...item, noteCount: index === 0 ? 2 : 0 })));
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
  });

  it("counts held seats: tickets and offers out", () => {
    const { unmount } = renderList();
    // Without seat counts, the list's own Going and Accepted stand in.
    expect(screen.getByText("2 of 60 seats · 1 going, 1 offer out")).toBeTruthy();
    unmount();
    render(
      <ReviewApplicationsClient
        eventId="e1"
        eventName="UXathon"
        capacity={60}
        seats={{ tickets: 40, heldOffers: 12 }}
        applications={items}
      />,
    );
    const card = screen.getByRole("group", { name: "Seats held" });
    expect(within(card).getByText("52 of 60 seats · 40 going, 12 offers out")).toBeTruthy();
  });

  it("says so when nobody has applied", () => {
    renderList([]);
    expect(screen.getByText("No applications yet")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
