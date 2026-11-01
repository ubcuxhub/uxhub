// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { contrastRatio, eventColourTint } from "@/lib/event-colour";

import { Ticket, ticketAppearance } from "./Ticket";

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

  it("picks a dark label on pale colours and a white one on deep colours", () => {
    expect(labelColour("#F3E9C6")).toBe("rgb(17, 17, 17)");
    expect(labelColour("#FFFFFF")).toBe("rgb(17, 17, 17)");
    expect(labelColour("#C983C7")).toBe("rgb(17, 17, 17)");
    expect(labelColour("#325DC4")).toBe("rgb(255, 255, 255)");
    expect(labelColour("#4A5E8A")).toBe("rgb(255, 255, 255)");
  });

  it("keeps the label at AA contrast along the whole gradient", () => {
    const hexes = [
      "#325DC4",
      "#C983C7",
      "#4A5E8A",
      "#F3E9C6",
      "#FFFFFF",
      "#000000",
      "#808080",
      "#2F8F6B",
      "#E0457B",
    ];
    for (const hex of hexes) {
      const { label, tint } = ticketAppearance(hex);
      expect(contrastRatio(hex, label), `${hex} base`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(eventColourTint(hex, tint), label),
        `${hex} top`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("holds back the white tint on Blue, where the old fill gave 2.8:1", () => {
    const { tint } = ticketAppearance("#325DC4");
    expect(tint).toBeLessThan(0.45);
    expect(tint).toBeGreaterThan(0);
    // A colour whose label already passes keeps the full tint.
    expect(ticketAppearance("#F3E9C6").tint).toBe(0.45);
  });

  it("falls back to the default colour for an invalid hex", () => {
    expect(() => render(<Ticket {...base} eventColour="not-a-colour" />)).not.toThrow();
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
    // The state is in the name too, not only in the greyscale.
    expect(
      screen.getByRole("article", {
        name: "Ticket for Design Sprint, not confirmed",
      }),
    ).toBeTruthy();
    expect(
      container.querySelector("[data-slot='ticket-shape']")?.className,
    ).toContain("grayscale");
  });

  it("says it is not confirmed yet when pending and no caption is given", () => {
    const { container } = render(<Ticket {...base} state="pending" />);

    expect(screen.getByText("Not confirmed yet")).toBeTruthy();
    expect(
      container.querySelector("[data-slot='ticket-caption'] svg"),
    ).toBeTruthy();
  });

  it("cuts the notches out instead of painting them over the surface", () => {
    const { container } = render(<Ticket {...base} />);
    const shape = container.querySelector(
      "[data-slot='ticket-shape']",
    ) as HTMLElement;

    expect(container.innerHTML).not.toContain("bg-background");
    const mask =
      shape.style.maskImage || shape.style.getPropertyValue("-webkit-mask-image");
    expect(mask.match(/radial-gradient/g)).toHaveLength(2);
  });

  it("says Checked in when used and keeps a dimmed code", () => {
    render(<Ticket {...base} state="used" code={<svg data-testid="qr" />} />);

    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(
      screen.getByRole("article", { name: "Ticket for Design Sprint, checked in" }),
    ).toBeTruthy();
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
