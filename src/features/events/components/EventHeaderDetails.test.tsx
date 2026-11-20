// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ParticipantLocation } from "@/lib/location";

import { displayUrl, EventHeaderDetails } from "./EventHeaderDetails";

afterEach(cleanup);

const base = {
  // Mon, Jan 11, 2027, 9:00 AM to 7:00 PM Pacific (UTC-7 all year from 2026).
  startsAt: "2027-01-11T09:00:00-07:00",
  endsAt: "2027-01-11T19:00:00-07:00",
  location: null,
  fallbackBuilding: null,
  website: null,
};

const venue: ParticipantLocation = {
  type: "in_person",
  restricted: false,
  building: "UBC AMS Nest",
  room: "The Great Hall",
  address: "6133 University Blvd, Vancouver, BC V6T 1Z1",
  map_url: "https://maps.example.com/nest",
};

const online: ParticipantLocation = {
  type: "online",
  restricted: false,
  meeting_url: "https://ubc.zoom.us/j/1234567890",
  meeting_id: "123 456 7890",
  meeting_passcode: "uxhub",
};

describe("EventHeaderDetails", () => {
  it("dates a one-day event with its times in Pacific", () => {
    render(<EventHeaderDetails {...base} />);
    expect(screen.getByText("Mon, Jan 11, 2027")).toBeTruthy();
    expect(screen.getByText("9:00 AM–7:00 PM PT")).toBeTruthy();
  });

  it("keeps a range for an event across days", () => {
    render(<EventHeaderDetails {...base} startsAt="2026-11-14T09:00:00-07:00" endsAt="2026-11-28T15:00:00-07:00" />);
    expect(screen.getByText("Sat, Nov 14, 2026 – Sat, Nov 28, 2026")).toBeTruthy();
    expect(screen.getByText("9:00 AM – 3:00 PM PT")).toBeTruthy();
  });

  it("puts the building and room on one line, with the address opening the map", () => {
    render(<EventHeaderDetails {...base} location={venue} />);
    expect(screen.getByText("UBC AMS Nest, The Great Hall")).toBeTruthy();
    const address = screen.getByRole("link", { name: /6133 University Blvd/ });
    expect(address.getAttribute("href")).toBe("https://maps.example.com/nest");
    expect(address.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("View on map")).toBeNull();
  });

  it("shows the public summary until the viewer is going", () => {
    render(
      <EventHeaderDetails
        {...base}
        location={{ type: "in_person", restricted: true, public_summary: "UBC Vancouver campus" }}
      />
    );
    expect(screen.getByText("UBC Vancouver campus")).toBeTruthy();
    expect(screen.getByText("Exact location shared once you’re going")).toBeTruthy();
  });

  it("gives an online event its own row: platform, Join meeting, and codes to copy", () => {
    render(<EventHeaderDetails {...base} location={online} />);
    expect(screen.getByText("Online · Zoom")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Join meeting/ }).getAttribute("href")).toBe(online.meeting_url);
    expect(screen.getByText("Meeting ID 123 456 7890")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy meeting ID" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy passcode" })).toBeTruthy();
    // No venue row for an online-only event: just the date and the meeting.
    expect(document.querySelectorAll("[data-slot='event-detail-row']")).toHaveLength(2);
  });

  it("hides the meeting link until the viewer is going", () => {
    render(<EventHeaderDetails {...base} location={{ type: "online", restricted: true, public_summary: "" }} />);
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("Meeting link shared once you’re going")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Join meeting/ })).toBeNull();
  });

  it("shows both a venue and an online row for a hybrid event", () => {
    render(<EventHeaderDetails {...base} location={{ ...venue, ...online, type: "hybrid" }} />);
    expect(screen.getByText("UBC AMS Nest, The Great Hall")).toBeTruthy();
    expect(screen.getByText("Online · Zoom")).toBeTruthy();
  });

  it("labels the website row Event website and shows the address itself", () => {
    render(
      <EventHeaderDetails
        {...base}
        website={{ kind: "external", href: "https://uxathon.example.com/", display: "uxathon.example.com" }}
      />
    );
    expect(screen.getByText("Event website")).toBeTruthy();
    expect(screen.getByRole("link", { name: /uxathon\.example\.com/ }).getAttribute("target")).toBe("_blank");
  });
});

describe("displayUrl", () => {
  it("drops the scheme, www and a trailing slash", () => {
    expect(displayUrl("https://www.ubcuxhub.ca/ux-conference/")).toBe("ubcuxhub.ca/ux-conference");
    expect(displayUrl("localhost:3000/events/sprint")).toBe("localhost:3000/events/sprint");
  });
});
