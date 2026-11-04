// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hubbo, HUBBO_ART, HUBBO_EMOTIONS } from "./Hubbo";

const original = { ...HUBBO_ART };

// Vitest resolves a PNG import to a bare path, not Next's `StaticImageData`,
// so give next/image real dimensions to render with.
beforeEach(() => {
  for (const emotion of HUBBO_EMOTIONS) {
    HUBBO_ART[emotion] = {
      full: { src: `/${emotion}-full.png`, width: 300, height: 350 },
      head: { src: `/${emotion}-head.png`, width: 100, height: 100 },
    };
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Object.assign(HUBBO_ART, original);
});

describe("Hubbo", () => {
  it("has full-body and head-only art registered for every emotion", () => {
    for (const emotion of HUBBO_EMOTIONS) {
      expect(original[emotion]?.full).toBeTruthy();
      expect(original[emotion]?.head).toBeTruthy();
    }
  });

  it.each([
    ["hero", "full", "h-60"],
    ["card", "full", "h-30"],
    ["inline", "head", "h-8"],
    ["head", "head", "h-10"],
  ] as const)("renders the %s size with %s art in production", (size, art, heightClass) => {
    vi.stubEnv("NODE_ENV", "production");
    for (const emotion of HUBBO_EMOTIONS) {
      const { container, unmount } = render(<Hubbo emotion={emotion} size={size} />);
      const img = container.querySelector("img");
      expect(img).toBeTruthy();
      expect(decodeURIComponent(img!.getAttribute("src")!)).toContain(`/${emotion}-${art}.png`);
      expect(img!.className).toContain(heightClass);
      expect(container.querySelector("[data-slot=hubbo-placeholder]")).toBeNull();
      unmount();
    }
  });

  it("renders nothing in production when a slot has no art", () => {
    vi.stubEnv("NODE_ENV", "production");
    HUBBO_ART.resting = { full: HUBBO_ART.resting?.full };
    const { container } = render(<Hubbo emotion="resting" size="head" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a dev placeholder naming the emotion when head art is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    HUBBO_ART.resting = { full: HUBBO_ART.resting?.full };
    const { container } = render(<Hubbo emotion="resting" size="head" />);
    const placeholder = container.querySelector("[data-slot=hubbo-placeholder]");
    expect(placeholder?.getAttribute("title")).toBe("Hubbo · resting · 40px");
  });

  it("renders a placeholder naming the emotion and size when a slot has no art", () => {
    vi.stubEnv("NODE_ENV", "development");
    HUBBO_ART.resting = {};
    render(<Hubbo emotion="resting" size="hero" />);
    expect(screen.getByText("Hubbo · resting")).toBeTruthy();
    expect(screen.getByText("240px")).toBeTruthy();
  });

  it("never renders bracketed placeholder copy", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const emotion of HUBBO_EMOTIONS) {
      HUBBO_ART[emotion] = {};
      const { container, unmount } = render(<Hubbo emotion={emotion} size="card" />);
      expect(container.textContent).not.toMatch(/\[|insert/i);
      unmount();
    }
  });

  it("is decorative by default", () => {
    const { container } = render(<Hubbo emotion="resting" size="card" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes alt text when the illustration carries meaning", () => {
    render(<Hubbo emotion="resting" size="card" alt="Hubbo resting" />);
    const img = screen.getByAltText("Hubbo resting");
    expect(img.getAttribute("aria-hidden")).toBeNull();
  });

  it("sizes by height and keeps the aspect ratio", () => {
    const { container } = render(<Hubbo emotion="resting" size="hero" />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("h-60");
    expect(img.className).toContain("w-auto");
  });
});
