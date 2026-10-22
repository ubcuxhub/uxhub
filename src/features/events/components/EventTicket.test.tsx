// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { toQrSvg } from "@/features/events/lib/qr-code";

import { EventTicket } from "./EventTicket";

afterEach(cleanup);

const event = {
  name: "Design Sprint",
  date: "November 4, 2026",
  time: "6:00 p.m. – 8:30 p.m.",
  location: "ICICS, X150",
};
const holder = { name: "Ada Lovelace", email: "ada@student.ubc.ca" };
const qrToken = "3f1c9a52-8d4e-4b7a-9c61-2e5f0d8b7a14.q1v8Zx3mR0aT9cLwP2nYkA";
const QR_CODE = { name: "Check-in QR code" };

describe("EventTicket", () => {
  it("shows the event, the holder, and a code to scan", () => {
    render(<EventTicket event={event} holder={holder} qrToken={qrToken} />);

    expect(screen.getByRole("article", { name: "Ticket for Design Sprint" }));
    expect(screen.getByText("November 4, 2026"));
    expect(screen.getByText("ICICS, X150"));
    expect(screen.getByText("Ada Lovelace"));
    expect(screen.getByText("Going"));
    expect(screen.getByRole("img", QR_CODE));
  });

  it("draws the code for the token it was given", () => {
    render(<EventTicket event={event} holder={holder} qrToken={qrToken} />);

    const path = screen.getByRole("img", QR_CODE).querySelector("path");
    expect(path?.getAttribute("d")).toBe(toQrSvg(qrToken).path);
  });

  it("keeps the code after check-in", () => {
    render(
      <EventTicket
        event={event}
        holder={holder}
        badge="checked_in"
        qrToken={qrToken}
      />
    );

    expect(screen.getByText("Checked in"));
    expect(screen.getByRole("img", QR_CODE));
  });

  it("uses the student-facing badge and hides the code when they have no ticket", () => {
    render(
      <EventTicket
        event={event}
        holder={holder}
        badge="register_by"
        registerBy="Oct 20"
        qrToken={qrToken}
      />
    );

    expect(screen.getByText("Register by Oct 20"));
    expect(screen.queryByRole("img", QR_CODE)).toBeNull();
    expect(screen.queryByText("Cancelled")).toBeNull();
  });

  it("shows no code without a token", () => {
    render(<EventTicket event={event} holder={holder} />);

    expect(screen.queryByRole("img", QR_CODE)).toBeNull();
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
