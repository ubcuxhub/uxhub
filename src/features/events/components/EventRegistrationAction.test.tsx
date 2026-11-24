// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/events/design-sprint" }));

import { publicEventActionFor } from "@/features/events/lib/public-event-action";

import { EventRegistrationAction } from "./EventRegistrationAction";

afterEach(cleanup);

const renderFor = (state: Parameters<typeof publicEventActionFor>[0]) =>
  render(<EventRegistrationAction action={publicEventActionFor(state, "design-sprint")} />);

describe("EventRegistrationAction", () => {
  it("registers through the checkout, coming back to the event page", () => {
    renderFor({ kind: "reg-open", closesAt: null });
    const link = screen.getByRole("link", { name: "Register Now" });
    expect(link.getAttribute("href")).toBe("/portal/events/design-sprint/checkout?returnTo=%2Fevents%2Fdesign-sprint");
  });

  it("applies on the application form for an application event", () => {
    renderFor({ kind: "app-open", closesAt: null });
    expect(screen.queryByRole("link", { name: "Register Now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Apply" }).getAttribute("href")).toBe("/portal/events/design-sprint/apply");
  });

  it("sends a ticket holder to their ticket rather than offering to register again", () => {
    renderFor({ kind: "reg-going", ticketId: "ticket-1" });
    expect(screen.getByRole("link", { name: "View Your Ticket" }).getAttribute("href")).toBe("/portal/events/design-sprint");
  });

  it("sends an applicant to their application rather than offering Apply again", () => {
    renderFor({ kind: "app-in-review" });
    expect(screen.queryByRole("link", { name: "Apply" })).toBeNull();
    expect(screen.getByRole("link", { name: "View Your Application" }).getAttribute("href")).toBe("/portal/events/design-sprint");
  });

  it("shows why it's unavailable", () => {
    renderFor({ kind: "reg-past" });
    expect(screen.queryByRole("link")).toBeNull();
    expect((screen.getByRole("button", { name: "Event Ended" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
