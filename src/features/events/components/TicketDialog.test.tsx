// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TicketDialog } from "./TicketDialog";

afterEach(cleanup);

const props = {
  eventName: "Design Sprint",
  holderName: "Ada Lovelace",
  qrToken: "3f1c9a52-8d4e-4b7a-9c61-2e5f0d8b7a14.q1v8Zx3mR0aT9cLwP2nYkA",
  dateLabel: "Nov 14 and 28, 2026",
  trigger: <button type="button">View ticket</button>,
};

describe("TicketDialog", () => {
  it("opens the ticket from its trigger, titled and described", () => {
    render(<TicketDialog {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    const dialog = screen.getByRole("dialog", { name: "Your ticket" });
    expect(dialog.textContent).toContain("Design Sprint · Nov 14 and 28, 2026");
    expect(screen.getByRole("img", { name: "Check-in QR code" })).toBeTruthy();
    expect(dialog.textContent).toContain("Show this code at check-in.");
  });

  it("leaves the date out when there isn't one", () => {
    render(<TicketDialog {...props} dateLabel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    expect(screen.getByRole("dialog").textContent).toContain("Design Sprint");
    expect(screen.getByRole("dialog").textContent).not.toContain("·");
  });
});
