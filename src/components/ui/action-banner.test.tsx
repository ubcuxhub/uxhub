// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Info } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { ActionBanner } from "./action-banner";

afterEach(cleanup);

describe("ActionBanner", () => {
  it("is a region labelled by its title", () => {
    render(
      <ActionBanner title="You’re accepted to Design Sprint.">
        Confirm your spot by Nov 14.
      </ActionBanner>,
    );
    const region = screen.getByRole("region", {
      name: "You’re accepted to Design Sprint.",
    });
    const titleId = region.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)?.textContent).toBe(
      "You’re accepted to Design Sprint.",
    );
  });

  it("never interrupts: no alert or status role", () => {
    const { container } = render(<ActionBanner title="Become a member" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector("[role=alert],[role=status]")).toBeNull();
  });

  it("gives two banners distinct label ids", () => {
    render(
      <>
        <ActionBanner title="First" />
        <ActionBanner title="Second" />
      </>,
    );
    const [a, b] = screen
      .getAllByRole("region")
      .map((el) => el.getAttribute("aria-labelledby"));
    expect(a).not.toBe(b);
  });

  it("renders the body and a focusable action", () => {
    render(
      <ActionBanner title="T" action={<button type="button">Confirm spot</button>}>
        Confirm your spot by Nov 14.
      </ActionBanner>,
    );
    expect(screen.getByText("Confirm your spot by Nov 14.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm spot" })).toBeTruthy();
  });

  it("shows no icon by default, and a hidden one when asked", () => {
    const { container, rerender } = render(<ActionBanner title="T" />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<ActionBanner title="T" icon={Info} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("omits the body and action wrappers when absent", () => {
    const { container } = render(<ActionBanner title="T" />);
    expect(container.querySelector("[data-slot=action-banner-body]")).toBeNull();
    expect(container.querySelector("[data-slot=action-banner-action]")).toBeNull();
  });
});
