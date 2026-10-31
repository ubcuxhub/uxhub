// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { readableTextOn } from "@/lib/event-colour";

import { Ticket } from "./Ticket";

afterEach(cleanup);

const base = { eventName: "Design Sprint", holderName: "John Doe" };

function labelColour(eventColour: string) {
  const { container } = render(<Ticket {...base} eventColour={eventColour} />);
  const article = container.querySelector("article") as HTMLElement;
  const colour = article.style.color;
  cleanup();
  return colour;
}

describe("Ticket", () => {
  it("is an article named for the event, and prints the holder", () => {
    render(<Ticket {...base} />);

    const article = screen.getByRole("article", {
      name: "Ticket for Design Sprint",
    });
    expect(article.textContent).toContain("Design Sprint");
    expect(article.textContent).toContain("John Doe");
  });

  it("takes its label colour from readableTextOn", () => {
    for (const hex of ["#325DC4", "#C983C7", "#4A5E8A", "#F3E9C6", "#FFFFFF"]) {
      const expected =
        readableTextOn(hex) === "light"
          ? "rgb(255, 255, 255)"
          : "rgb(17, 17, 17)";
      expect(labelColour(hex), hex).toBe(expected);
    }
    // The pale colour gets the dark label, the default Blue the light one.
    expect(labelColour("#F3E9C6")).toBe("rgb(17, 17, 17)");
    expect(labelColour("#325DC4")).toBe("rgb(255, 255, 255)");
  });

  it("paints the event colour as a gradient", () => {
    const { container } = render(<Ticket {...base} eventColour="#C983C7" />);
    const shape = container.querySelector(
      "[data-slot='ticket-shape']",
    ) as HTMLElement;
    expect(shape.style.background).toContain("linear-gradient");
  });

  it("shows the code in the QR slot when active", () => {
    render(<Ticket {...base} code={<svg data-testid="qr" />} />);
    expect(screen.getByTestId("qr")).toBeTruthy();
  });

  it("hides the code while pending and greys the ticket", () => {
    const { container } = render(
      <Ticket
        {...base}
        state="pending"
        code={<svg data-testid="qr" />}
        caption="Confirm by Nov 14"
      />,
    );

    expect(screen.queryByTestId("qr")).toBeNull();
    expect(screen.getByText("Confirm by Nov 14")).toBeTruthy();
    expect(
      container.querySelector("[data-slot='ticket-shape']")?.className,
    ).toContain("grayscale");
  });

  it("says Checked in when used and keeps a dimmed code", () => {
    render(<Ticket {...base} state="used" code={<svg data-testid="qr" />} />);

    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.getByTestId("qr").parentElement?.className).toContain(
      "opacity-50",
    );
  });

  it("renders the action", () => {
    render(
      <Ticket {...base} action={<button type="button">View ticket</button>} />,
    );
    expect(screen.getByRole("button", { name: "View ticket" })).toBeTruthy();
  });
});
