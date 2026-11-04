// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventCard, EventCardDates } from "./EventCard";

afterEach(cleanup);

/** The text of the elements an `aria-describedby` points at. */
function describedBy(element: HTMLElement) {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .join(" ");
}

const lines = [{ day: "Sat, Jan 9", time: "9:00 AM–7:00 PM" }];

describe("EventCard", () => {
  it("is one link, named by the title and described by its dates and status", () => {
    render(
      <EventCard
        title="UXathon"
        href="/portal/events/uxathon"
        venue="UBC Henry Angus (ANGU)"
        when={<EventCardDates lines={lines} />}
        status="registration_open"
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    // An exact-string name: venue, dates and status are not part of it.
    const link = screen.getByRole("link", { name: "UXathon" });
    expect(describedBy(link)).toBe("Sat, Jan 9 9:00 AM–7:00 PM Registration open");
    expect(link.getAttribute("href")).toBe("/portal/events/uxathon");
  });

  it("puts the title in a heading, h3 unless told otherwise", () => {
    const { rerender } = render(
      <EventCard title="UXathon" href="/x" when="Sat, Jan 9" />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "UXathon" })).toBeTruthy();

    rerender(
      <EventCard title="UXathon" href="/x" when="Sat, Jan 9" headingLevel="h2" />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "UXathon" })).toBeTruthy();
  });

  it("shows the venue, dates and status", () => {
    render(
      <EventCard
        title="UXathon"
        href="/x"
        venue="UBC Henry Angus (ANGU)"
        when={<EventCardDates lines={lines} />}
        status="waitlisted"
      />,
    );
    expect(screen.getByText("UBC Henry Angus (ANGU)")).toBeTruthy();
    expect(screen.getByText("Sat, Jan 9")).toBeTruthy();
    expect(screen.getByText("Waitlisted")).toBeTruthy();
  });

  it("tells repeated events apart by the date in the link description", () => {
    render(
      <>
        <EventCard title="Portfolio Review" href="/a" when="Sat, Jan 9" />
        <EventCard title="Portfolio Review" href="/b" when="Sat, Jan 16" />
      </>,
    );
    const links = screen.getAllByRole("link", { name: "Portfolio Review" });
    expect(links.map(describedBy)).toEqual(["Sat, Jan 9", "Sat, Jan 16"]);
  });

  it("shows the dated student labels, or a custom label and tone", () => {
    const { rerender } = render(
      <EventCard
        title="UXathon"
        href="/x"
        when="Sat, Jan 9"
        status={{ status: "register_by", date: "Oct 20" }}
      />,
    );
    expect(screen.getByText("Register by Oct 20")).toBeTruthy();

    rerender(
      <EventCard
        title="UXathon"
        href="/x"
        when="Sat, Jan 9"
        status={{ label: "Invite only", tone: "info" }}
      />,
    );
    expect(screen.getByText("Invite only")).toBeTruthy();
  });

  it("omits the venue and badge when they are not given", () => {
    render(<EventCard title="UXathon" href="/x" when="Sat, Jan 9" status={null} />);
    expect(document.querySelector("[data-slot=badge]")).toBeNull();
  });

  it("renders a decorative thumbnail from the image, or a fallback icon", () => {
    const { container, rerender } = render(
      <EventCard title="UXathon" href="/x" when="Sat, Jan 9" image={{ src: "/a.png" }} />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/a.png");
    expect(img?.getAttribute("alt")).toBe("");

    rerender(<EventCard title="UXathon" href="/x" when="Sat, Jan 9" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-slot=event-card-thumbnail] svg")).toBeTruthy();
  });

  it("falls back to the calendar icon when the image fails to load", () => {
    const { container, rerender } = render(
      <EventCard title="UXathon" href="/x" when="Sat, Jan 9" image={{ src: "/gone.png" }} />,
    );
    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-slot=event-card-thumbnail] svg")).toBeTruthy();

    // A different image gets a fresh try.
    rerender(
      <EventCard title="UXathon" href="/x" when="Sat, Jan 9" image={{ src: "/new.png" }} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/new.png");
  });
});

describe("EventCardDates", () => {
  it("separates two lines with a dash that reads as 'to'", () => {
    render(
      <EventCardDates
        lines={[
          { day: "Sat, Jan 9", time: "9:00 AM" },
          { day: "Sun, Jan 10", time: "3:00 PM" },
        ]}
      />,
    );
    expect(screen.getByText("to")).toBeTruthy();
    expect(screen.getByText("Sun, Jan 10")).toBeTruthy();
  });
});
