// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/portal/events/uxathon" }));

import { ApplicationStatusNotice } from "./ApplicationStatusNotice";

afterEach(cleanup);

const base = {
  eventName: "UXathon 2027",
  eventSlug: "uxathon",
  registrationOpensAt: "2026-12-06T00:00:00Z",
  registrationClosesAt: "2026-12-14T06:59:00Z",
};

describe("ApplicationStatusNotice", () => {
  it("links Apply and Continue application to the form", () => {
    const { rerender } = render(<ApplicationStatusNotice {...base} callout={{ kind: "apply" }} />);
    expect(screen.getByRole("link", { name: "Apply" }).getAttribute("href")).toBe(
      "/portal/events/uxathon/apply"
    );
    expect(screen.getByText(/Apply by December 13, 2026\./)).toBeTruthy();

    rerender(<ApplicationStatusNotice {...base} callout={{ kind: "draft" }} />);
    expect(screen.getByRole("link", { name: "Continue application" })).toBeTruthy();
  });

  it("sends an accepted member to checkout with the offer's deadline", () => {
    render(
      <ApplicationStatusNotice
        {...base}
        callout={{ kind: "accepted", offerExpiresAt: "2026-11-20T06:59:00Z" }}
      />
    );
    expect(screen.getByText("You’re accepted to UXathon 2027.")).toBeTruthy();
    expect(screen.getByText(/Register by November 19, 2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Register" }).getAttribute("href")).toContain(
      "/portal/events/uxathon/checkout"
    );
  });

  it("shows a decision with its badge and no action", () => {
    render(<ApplicationStatusNotice {...base} callout={{ kind: "not_selected" }} />);
    expect(screen.getByText("Not selected")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lets a pending applicant read what they sent", () => {
    render(<ApplicationStatusNotice {...base} callout={{ kind: "pending" }} />);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View application" })).toBeTruthy();
  });
});
