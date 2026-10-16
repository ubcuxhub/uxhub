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
    expect(screen.getByText("Going"));
    expect(screen.getByRole("img", { name: "QR code placeholder" }));
  });

  it("keeps the code after check-in", () => {
    render(<EventTicket event={event} holder={holder} badge="checked_in" />);

    expect(screen.getByText("Checked in"));
    expect(screen.getByRole("img", { name: "QR code placeholder" }));
  });

  it("uses the student-facing badge and hides the code when they have no ticket", () => {
    render(
      <EventTicket
        event={event}
        holder={holder}
        badge="register_by"
        registerBy="Oct 20"
      />
    );

    expect(screen.getByText("Register by Oct 20"));
    expect(screen.queryByRole("img", { name: "QR code placeholder" })).toBeNull();
    expect(screen.queryByText("Cancelled")).toBeNull();
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
