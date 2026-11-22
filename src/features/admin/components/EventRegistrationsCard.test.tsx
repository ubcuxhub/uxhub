// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRegistrationsCard, type EventRegistrationsCardProps } from "./EventRegistrationsCard";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const REVIEW = `/admin/events/${EVENT_ID}/review-applications`;

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderCard(props: Partial<EventRegistrationsCardProps> = {}) {
  return render(
    <EventRegistrationsCard
      eventId={EVENT_ID}
      capacity={20}
      tickets={3}
      seatsLeft={17}
      checkedIn={1}
      {...props}
    />
  );
}

afterEach(cleanup);

describe("EventRegistrationsCard", () => {
  it("shows tickets against capacity, the spots left and a bar", () => {
    const { container } = renderCard();
    const card = screen.getByRole("group", { name: "Registrations" });
    expect(card.textContent).toContain("3 / 20");
    expect(within(card).getByText("17 spots left")).toBeTruthy();
    expect(container.querySelector("[style*='width: 15%']")).not.toBeNull();
    expect(within(card).getByText("Going").nextElementSibling?.textContent).toBe("3");
    expect(within(card).getByText("Checked in").nextElementSibling?.textContent).toBe("1");
  });

  it("counts held offers out of the spots left, never below zero", () => {
    renderCard({ tickets: 20, seatsLeft: 0 });
    expect(screen.getByText("0 spots left")).toBeTruthy();
    cleanup();
    renderCard({ tickets: 19, seatsLeft: 1 });
    expect(screen.getByText("1 spot left")).toBeTruthy();
  });

  it("shows only the count without a capacity", () => {
    const { container } = renderCard({ capacity: null, seatsLeft: null, tickets: 7 });
    const card = screen.getByRole("group", { name: "Registrations" });
    expect(card.textContent).not.toContain("/");
    expect(within(card).getByText("No capacity limit")).toBeTruthy();
    expect(container.querySelector("[style*='width']")).toBeNull();
  });

  it("leaves out applications for an event that doesn't take them", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: "Applications" })).toBeNull();
    expect(screen.queryByText("To review")).toBeNull();
  });

  it("breaks down applications, each count linking to its chips on the review list", () => {
    renderCard({
      applications: { submitted: 4, accepted: 6, waitlisted: 2, rejected: 3, total: 15 },
    });
    const section = screen.getByRole("group", { name: "Applications" });
    const link = (name: string) => within(section).getByRole("link", { name }).getAttribute("href");

    expect(link("15 in total")).toBe(`${REVIEW}?status=all`);
    expect(link("4 to review")).toBe(REVIEW);
    expect(link("6 accepted")).toBe(
      `${REVIEW}?status=${encodeURIComponent("accepted,registered,offer_expired")}`
    );
    expect(link("2 waitlisted")).toBe(`${REVIEW}?status=waitlisted`);
    expect(link("3 rejected")).toBe(`${REVIEW}?status=rejected`);
    expect(
      within(section)
        .getAllByRole("term")
        .map((term) => term.textContent)
    ).toEqual(["To review", "Accepted", "Waitlisted", "Rejected"]);
  });
});
