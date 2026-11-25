// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EVENT_HEADER_ASPECT, EventPageHeader } from "./EventPageHeader";

afterEach(cleanup);

const banner = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="event-page-header-banner"]')!;
const icon = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="event-page-header-icon"]');

describe("EventPageHeader", () => {
  it("draws the banner at the aspect the header picker crops to", () => {
    const { container } = render(<EventPageHeader />);
    expect(banner(container).className).toContain(`aspect-${EVENT_HEADER_ASPECT}/1`);
  });

  it("draws the header image over the colour", () => {
    const { container } = render(<EventPageHeader imageSrc="/header.png" colour="#325DC4" />);
    expect(banner(container).querySelector("img")?.getAttribute("src")).toBe("/header.png");
    expect(banner(container).style.backgroundColor).toBe("rgb(50, 93, 196)");
  });

  it("falls back to the muted fill with no colour", () => {
    const { container } = render(<EventPageHeader colour="" />);
    expect(banner(container).style.backgroundColor).toBe("");
    expect(banner(container).querySelector("img")).toBeNull();
  });

  it("shows the icon over the banner's corner", () => {
    const { container } = render(<EventPageHeader iconSrc="/icon.png" />);
    expect(icon(container)?.querySelector("img")?.getAttribute("src")).toBe("/icon.png");
  });

  it("draws the icon as a fixed 96px bordered tile, 32px in and half below the banner (Figma 1.3)", () => {
    const { container } = render(<EventPageHeader iconSrc="/icon.png" />);
    expect(icon(container)?.className).toEqual(
      expect.stringMatching(/(?=.*\bsize-24\b)(?=.*\bleft-8\b)(?=.*\brounded-xl\b)(?=.*\bborder-4\b)(?=.*\bborder-card\b)/)
    );
    expect(container.querySelector('[aria-hidden].h-12')).not.toBeNull();
  });

  it("leaves the icon out when there is none, unless a placeholder is asked for", () => {
    const { container, rerender } = render(<EventPageHeader />);
    expect(icon(container)).toBeNull();
    rerender(<EventPageHeader iconPlaceholder />);
    expect(icon(container)).not.toBeNull();
    expect(icon(container)?.querySelector("img")).toBeNull();
  });
});
