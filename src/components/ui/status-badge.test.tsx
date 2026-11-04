// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Star } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import {
  STATUSES,
  STUDENT_EVENT_STATUSES,
  StatusBadge,
} from "./status-badge";

afterEach(cleanup);

function badge() {
  return document.querySelector("[data-slot=badge]") as HTMLElement;
}

describe("StatusBadge", () => {
  it("keeps the nine core statuses, each with an icon and a label", () => {
    expect(STATUSES).toHaveLength(9);
    for (const status of STATUSES) {
      render(<StatusBadge status={status} />);
      expect(badge().querySelector("svg"), status).toBeTruthy();
      expect(badge().textContent?.length, status).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("renders a core status with its existing label and tone", () => {
    render(<StatusBadge status="waitlisted" />);
    expect(screen.getByText("Waitlisted")).toBeTruthy();
    expect(badge().className).toContain("bg-warning");
  });

  it("says the student event-card labels with their tones", () => {
    const cases = [
      [{ status: "opens", date: "Oct 12" }, "Opens Oct 12", "bg-info"],
      [{ status: "register_by", date: "Oct 20" }, "Register by Oct 20", "bg-info"],
      [{ status: "registration_closed" }, "Registration closed", "bg-muted"],
      [{ status: "under_review" }, "Under review", "bg-warning"],
      [{ status: "offer_expired" }, "Offer expired", "bg-muted"],
    ] as const;
    for (const [props, text, tone] of cases) {
      render(<StatusBadge {...props} />);
      expect(badge().textContent, text).toBe(text);
      expect(badge().className, text).toContain(tone);
      expect(badge().querySelector("svg"), text).toBeTruthy();
      cleanup();
    }
    expect(STUDENT_EVENT_STATUSES).toHaveLength(5);
  });

  it("still reads sensibly when a dated status has no date", () => {
    render(<StatusBadge status="opens" />);
    expect(badge().textContent).toBe("Opens soon");
  });

  it("takes a fully custom label, tone and icon", () => {
    render(<StatusBadge label="Invite only" tone="warning" icon={Star} />);
    expect(badge().textContent).toBe("Invite only");
    expect(badge().className).toContain("bg-warning");
    expect(badge().querySelector("svg")).toBeTruthy();
  });

  it("lets a label or tone override a named status", () => {
    render(<StatusBadge status="going" label="Going (2)" tone="info" />);
    expect(badge().textContent).toBe("Going (2)");
    expect(badge().className).toContain("bg-info");
  });
});
