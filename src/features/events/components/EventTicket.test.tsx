// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ticketAppearance } from "@/components/shared/Ticket";
import { toQrSvg } from "@/features/events/lib/qr-code";

import { EventTicket } from "./EventTicket";

afterEach(cleanup);

const base = {
  eventName: "Design Sprint",
  holderName: "Ada Lovelace",
  qrToken: "9f86d081884c7d659a2feaa0c55ad015",
};
const QR_CODE = { name: "Check-in QR code" };

describe("EventTicket", () => {
  it("shows the event, the holder, and a code to scan", () => {
    render(<EventTicket {...base} />);

    const article = screen.getByRole("article", { name: "Ticket for Design Sprint" });
    expect(article.textContent).toContain("Design Sprint");
    expect(article.textContent).toContain("Ada Lovelace");
    expect(screen.getByRole("img", QR_CODE)).toBeTruthy();
  });

  it("draws the code for the token it was given", () => {
    render(<EventTicket {...base} />);

    const path = screen.getByRole("img", QR_CODE).querySelector("path");
    expect(path?.getAttribute("d")).toBe(toQrSvg(base.qrToken).path);
  });

  it("takes its label colour from the event colour, as the compact Ticket does", () => {
    render(<EventTicket {...base} eventColour="#F2C94C" />);

    const article = screen.getByRole("article", { name: "Ticket for Design Sprint" });
    const expected = document.createElement("div");
    expected.style.color = ticketAppearance("#F2C94C").label;
    expect(article.style.color).toBe(expected.style.color);
  });

  it("shows the event image, or an icon without one", () => {
    const event = "img[src*='example.com']";
    const { container, rerender } = render(<EventTicket {...base} imageUrl="https://example.com/a.png" />);
    expect(container.querySelector(event)).toBeTruthy();

    rerender(<EventTicket {...base} imageUrl={null} />);
    expect(container.querySelector(event)).toBeNull();
    expect(container.querySelector("svg.lucide-image")).toBeTruthy();
  });

  it("flips to the logo and back, keeping only the visible side reachable", () => {
    const { container } = render(<EventTicket {...base} />);
    const [front, back] = container.querySelectorAll("[inert], .backface-hidden");
    expect(front.hasAttribute("inert")).toBe(false);
    expect(back.hasAttribute("inert")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Flip ticket to show UX Hub logo" }));
    expect(front.hasAttribute("inert")).toBe(true);
    expect(back.hasAttribute("inert")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Flip ticket to show QR code" }));
    expect(front.hasAttribute("inert")).toBe(false);
  });

  it("puts the white logo on deep colours and the black one on pale colours", () => {
    const logo = () => screen.getByRole("img", { name: "UBC UX Hub" }).getAttribute("src");
    render(<EventTicket {...base} eventColour="#325DC4" />);
    expect(logo()).toContain("logo-stacked-white");
    cleanup();

    render(<EventTicket {...base} eventColour="#F2C94C" />);
    expect(logo()).toContain("logo-stacked-black");
  });
});
