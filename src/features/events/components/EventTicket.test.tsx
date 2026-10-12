// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventTicket } from "./EventTicket";

afterEach(cleanup);

const event = {
  name: "Design Sprint",
  date: "November 4, 2026",
  time: "6:00 p.m. – 8:30 p.m.",
  location: "ICICS, X150",
};
const holder = { name: "Ada Lovelace", email: "ada@student.ubc.ca" };

describe("EventTicket", () => {
  it("shows the event, the holder, and a code to scan", () => {
    render(<EventTicket event={event} holder={holder} />);

    expect(screen.getByRole("article", { name: "Ticket for Design Sprint" }));
    expect(screen.getByText("November 4, 2026"));
    expect(screen.getByText("ICICS, X150"));
    expect(screen.getByText("Ada Lovelace"));
    expect(screen.getByText("Admit one"));
    expect(screen.getByRole("img", { name: "QR code placeholder" }));
  });

  it("keeps the code scannable after check-in and shows when", () => {
    render(
      <EventTicket
        event={event}
        holder={holder}
        status="checked_in"
        checkedInAt="2026-07-15T17:02:00Z"
      />
    );

    expect(screen.getByText("Checked in 10:02 a.m."));
    expect(screen.getByRole("img", { name: "QR code placeholder" }));
  });

  it("hides the code once the ticket is cancelled", () => {
    render(<EventTicket event={event} holder={holder} status="cancelled" />);

    expect(screen.getByText("Cancelled"));
    expect(screen.getByText("This ticket is no longer valid."));
    expect(screen.queryByRole("img", { name: "QR code placeholder" })).toBeNull();
  });

  it("falls back to TBD for unscheduled details", () => {
    render(
      <EventTicket
        event={{ name: "Design Sprint", date: null, time: null, location: null }}
        holder={{ name: "Ada Lovelace" }}
      />
    );

    expect(screen.getAllByText("TBD")).toHaveLength(2);
  });
});
