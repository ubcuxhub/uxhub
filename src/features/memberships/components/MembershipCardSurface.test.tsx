// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MembershipCardSurface } from "./MembershipCardSurface";

let matches: Record<string, boolean> = {};

beforeEach(() => {
  matches = { "(hover: hover) and (pointer: fine)": true, "(prefers-reduced-motion: reduce)": false };
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches[query] ?? false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // Run animation frames straight away; 0 means none is left pending.
  vi.stubGlobal("requestAnimationFrame", (step: FrameRequestCallback) => {
    step(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCard() {
  render(
    <MembershipCardSurface>
      <p>Ada Lovelace</p>
    </MembershipCardSurface>,
  );
  const card = screen.getByText("Ada Lovelace").closest("section")!;
  const frame = card.parentElement!;
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  return { card, frame };
}

function point(frame: HTMLElement, clientX: number, clientY: number, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX, clientY });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    frame.dispatchEvent(event);
  });
}

it("lays the shared dither texture over the gradient, hidden from assistive tech", () => {
  const { card } = renderCard();
  const dither = card.querySelector('[data-slot="dither-overlay"]');
  expect(dither?.getAttribute("aria-hidden")).toBe("true");
  expect(card.className).toContain("bg-membership-card");
});

it("tilts up to 4 degrees toward a mouse pointer and settles back when it leaves", () => {
  const { card, frame } = renderCard();

  point(frame, 400, 0); // top-right corner
  expect(card.style.getPropertyValue("--tilt-x")).toBe("4.00deg");
  expect(card.style.getPropertyValue("--tilt-y")).toBe("4.00deg");

  point(frame, 200, 100); // centre
  expect(card.style.getPropertyValue("--tilt-x")).toBe("0.00deg");

  fireEvent.pointerLeave(frame);
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
});

it("ignores touch and pen", () => {
  const { card, frame } = renderCard();
  point(frame, 400, 0, "touch");
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
});

it("doesn't tilt under reduced motion or without a fine pointer", () => {
  matches["(prefers-reduced-motion: reduce)"] = true;
  const reduced = renderCard();
  point(reduced.frame, 400, 0);
  expect(reduced.card.style.getPropertyValue("--tilt-x")).toBe("");
  cleanup();

  matches = { "(hover: hover) and (pointer: fine)": false };
  const coarse = renderCard();
  point(coarse.frame, 400, 0);
  expect(coarse.card.style.getPropertyValue("--tilt-x")).toBe("");
});
