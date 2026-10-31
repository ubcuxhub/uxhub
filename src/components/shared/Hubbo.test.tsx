// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Hubbo, HUBBO_ART, type HubboEmotion } from "./Hubbo";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete HUBBO_ART.resting;
});

describe("Hubbo", () => {
  it("renders nothing in production while there is no artwork", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<Hubbo emotion="resting" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a dev placeholder naming the emotion and size", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<Hubbo emotion="resting" size="hero" />);
    expect(screen.getByText("Hubbo · resting")).toBeTruthy();
    expect(screen.getByText("240px")).toBeTruthy();
  });

  it("never renders bracketed placeholder copy", () => {
    vi.stubEnv("NODE_ENV", "development");
    const emotions: HubboEmotion[] = ["welcoming", "curious", "excited", "proud", "thinking", "resting"];
    for (const emotion of emotions) {
      const { container, unmount } = render(<Hubbo emotion={emotion} size="card" />);
      expect(container.textContent).not.toMatch(/\[|insert/i);
      unmount();
    }
  });

  it("is decorative", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<Hubbo emotion="curious" size="inline" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses head art for the small sizes and full art for the large ones", () => {
    HUBBO_ART.resting = {
      full: { src: "/full.png", width: 480, height: 480 },
      head: { src: "/head.png", width: 96, height: 96 },
    };
    const { container, rerender } = render(<Hubbo emotion="resting" size="card" />);
    const img = () => container.querySelector("img")!;
    expect(img().getAttribute("src")).toContain("full.png");
    expect(img().getAttribute("alt")).toBe("");
    rerender(<Hubbo emotion="resting" size="head" />);
    expect(img().getAttribute("src")).toContain("head.png");
  });
});
