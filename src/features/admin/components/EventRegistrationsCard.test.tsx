// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventRegistrationsCard, type EventRegistrationsCardProps } from "./EventRegistrationsCard";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const REVIEW = `/admin/events/${EVENT_ID}/review-applications`;
const APPLICATIONS = { submitted: 4, accepted: 6, waitlisted: 2, rejected: 3, total: 15 };

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
      heldOffers={0}
      seatsLeft={17}
      checkedIn={1}
      {...props}
    />
  );
}

const card = () => screen.getByRole("group", { name: "Registrations" });
const value = (label: string) => within(card()).getByText(label).nextElementSibling?.textContent;
const segment = (container: HTMLElement, name: "tickets" | "held") =>
  container.querySelector<HTMLElement>(`[data-segment='${name}']`);

afterEach(cleanup);

describe("EventRegistrationsCard", () => {
  it("shows tickets against capacity, the spots left and a bar", () => {
    const { container } = renderCard();
    expect(card().textContent).toContain("3 / 20");
    expect(within(card()).getByText("17 spots left")).toBeTruthy();
    expect(segment(container, "tickets")?.style.width).toBe("15%");
    expect(segment(container, "held")).toBeNull();
    expect(value("Going")).toBe("3");
    expect(value("Checked in")).toBe("1");
  });

  it("counts held offers out of the spots left, never below zero", () => {
    renderCard({ tickets: 20, seatsLeft: 0 });
    expect(screen.getByText("0 spots left")).toBeTruthy();
    cleanup();
    renderCard({ tickets: 19, seatsLeft: 1 });
    expect(screen.getByText("1 spot left")).toBeTruthy();
  });

  it("explains an open offer with no tickets: its row, and a held band the spots left account for", () => {
    const { container } = renderCard({
      capacity: 100,
      tickets: 0,
      heldOffers: 1,
      seatsLeft: 99,
      checkedIn: 0,
      applications: { submitted: 0, accepted: 1, waitlisted: 0, rejected: 0, total: 1 },
    });
    expect(card().textContent).toContain("0 / 100");
    expect(within(card()).getByText("99 spots left")).toBeTruthy();
    expect(value("Going")).toBe("0");
    expect(value("Offers out")).toBe("1");
    // Nothing solid yet; the held band covers the one seat the offer holds.
    expect(segment(container, "tickets")).toBeNull();
    expect(segment(container, "held")?.style.width).toBe("1%");
  });

  it("draws tickets solid and offers out straight after them", () => {
    const { container } = renderCard({ tickets: 3, heldOffers: 2, seatsLeft: 15 });
    const tickets = segment(container, "tickets")!;
    const held = segment(container, "held")!;
    expect(tickets.style.width).toBe("15%");
    expect(tickets.className).toContain("bg-primary");
    // 10% more for the two offers, plus the bit tucked under the tickets' end.
    expect(held.style.width).toBe("calc(10% + 0.5rem)");
    expect(held.className).toContain("bg-primary/30");
    expect(held.className).toContain("-ml-2");
    expect(tickets.nextElementSibling).toBe(held);
  });

  it("caps the bar at the capacity", () => {
    const { container } = renderCard({ capacity: 10, tickets: 9, heldOffers: 4, seatsLeft: 0 });
    expect(segment(container, "tickets")?.style.width).toBe("90%");
    expect(segment(container, "held")?.style.width).toBe("calc(10% + 0.5rem)");
    cleanup();
    // Tickets alone fill it: no room left for a held band.
    const full = renderCard({ capacity: 300, tickets: 299, heldOffers: 1, seatsLeft: 0 });
    expect(segment(full.container, "tickets")?.style.width).toBe("100%");
    expect(segment(full.container, "held")).toBeNull();
  });

  it("keeps a lone ticket or offer visible on a big event", () => {
    const { container } = renderCard({ capacity: 1000, tickets: 1, heldOffers: 1, seatsLeft: 998 });
    // Both round to 0%; each still shows at least a dot.
    expect(segment(container, "tickets")?.style.width).toBe("0%");
    expect(segment(container, "tickets")?.className).toContain("min-w-2");
    expect(segment(container, "held")?.className).toContain("min-w-4");
  });

  it("lists Going, Offers out, then Checked in", () => {
    renderCard({ applications: APPLICATIONS, heldOffers: 2, seatsLeft: 15 });
    const top = within(card()).getByText("Going").closest("dl")!;
    expect(
      within(top)
        .getAllByRole("term")
        .map((term) => term.textContent)
    ).toEqual(["Going", "Offers out", "Checked in"]);
  });

  it("shows offers out, 0 included, on an event that takes applications", () => {
    renderCard({ applications: APPLICATIONS });
    expect(value("Offers out")).toBe("0");
  });

  it("leaves offers out off an event without applications, unless one is still out", () => {
    renderCard();
    expect(screen.queryByText("Offers out")).toBeNull();
    cleanup();
    renderCard({ heldOffers: 1, seatsLeft: 16 });
    expect(value("Offers out")).toBe("1");
  });

  it("shows only the counts without a capacity, offers out included", () => {
    const { container } = renderCard({
      capacity: null,
      seatsLeft: null,
      tickets: 7,
      heldOffers: 2,
      applications: APPLICATIONS,
    });
    expect(card().textContent).not.toContain("/");
    expect(within(card()).getByText("No capacity limit")).toBeTruthy();
    expect(container.querySelector("[data-segment]")).toBeNull();
    expect(value("Going")).toBe("7");
    expect(value("Offers out")).toBe("2");
  });

  it("leaves out applications for an event that doesn't take them", () => {
    renderCard();
    expect(screen.queryByRole("group", { name: "Applications" })).toBeNull();
    expect(screen.queryByText("To review")).toBeNull();
  });

  it("breaks down applications, each count linking to its chips on the review list", () => {
    renderCard({ applications: APPLICATIONS });
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
