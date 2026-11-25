// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventsBackPill } from "./EventsBackPill";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("EventsBackPill", () => {
  it("goes back to Upcoming by default", () => {
    render(<EventsBackPill />);
    expect(screen.getByRole("link", { name: "Back to Events" }).getAttribute("href")).toBe("/portal/events");
  });

  it("goes back to Past when the event was opened from Past", () => {
    window.sessionStorage.setItem("uxhub:events-view", "past");
    render(<EventsBackPill />);
    expect(screen.getByRole("link", { name: "Back to Events" }).getAttribute("href")).toBe(
      "/portal/events?view=past"
    );
  });
});
