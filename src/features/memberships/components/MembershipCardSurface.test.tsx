// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CARD } from "./membership-card-motion";
import { MembershipCardSurface } from "./MembershipCardSurface";

let matches: Record<string, boolean> = {};
let frames: FrameRequestCallback[] = [];
let now = 0;

beforeEach(() => {
  matches = { "(prefers-reduced-motion: no-preference)": true };
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches[query] ?? false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (step: FrameRequestCallback) => frames.push(step));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    if (id) frames[id - 1] = () => {};
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Runs pending animation frames, one 60fps frame apart, until none are left. */
function flushFrames(limit = 1000) {
  act(() => {
    for (let i = 0; i < limit; i++) {
      const pending = frames.filter(Boolean);
      frames = [];
      if (!pending.length) return;
      now += 1000 / 60;
      pending.forEach((step) => step(now));
    }
  });
}

function renderCard() {
  render(
    <MembershipCardSurface>
      <p>Ada Lovelace</p>
    </MembershipCardSurface>,
  );
  const front = screen.getByText("Ada Lovelace").closest("section")!;
  const card = front.parentElement!;
  const frame = card.parentElement!;
  frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  return { front, card, frame };
}

function pointer(
  frame: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  {
    pointerType = "mouse",
    pointerId = 1,
    isPrimary = true,
    timeStamp = now,
  }: { pointerType?: string; pointerId?: number; isPrimary?: boolean; timeStamp?: number } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: pointerId },
    isPrimary: { value: isPrimary },
    timeStamp: { value: timeStamp },
  });
  act(() => {
    frame.dispatchEvent(event);
  });
}

/** What the CSS transition would report once the snap or flip home lands. */
function finishTransition(card: HTMLElement) {
  const event = new Event("transitionend");
  Object.defineProperty(event, "propertyName", { value: "--spin" });
  act(() => {
    card.dispatchEvent(event);
  });
}

const spinOf = (card: HTMLElement) => parseFloat(card.style.getPropertyValue("--spin") || "0");

it("lays the shared dither texture over the gradient, with a glint, hidden from assistive tech", () => {
  const { front } = renderCard();
  const dither = front.querySelector('[data-slot="dither-overlay"]');
  expect(dither?.getAttribute("aria-hidden")).toBe("true");
  expect(front.querySelector('[data-slot="dither-glint"]')).not.toBeNull();
  expect(front.className).toContain("bg-membership-card");
});

it("draws a decorative back with the logo, facing away", () => {
  const { card } = renderCard();
  const back = card.querySelector('[data-slot="membership-card-back"]')!;
  expect(back.getAttribute("aria-hidden")).toBe("true");
  expect(back.className).toContain("membership-card-back");
  expect(back.querySelector("img")?.getAttribute("src")).toContain("icon-light.svg");
});

it("tilts up to HOVER_TILT_DEG toward a mouse pointer and settles back when it leaves", () => {
  const { card, frame } = renderCard();

  pointer(frame, "pointermove", 400, 0); // top-right corner
  flushFrames();
  const corner = `${CARD.HOVER_TILT_DEG.toFixed(2)}deg`;
  expect(card.style.getPropertyValue("--tilt-x")).toBe(corner);
  expect(card.style.getPropertyValue("--tilt-y")).toBe(corner);

  pointer(frame, "pointermove", 200, 100); // centre
  flushFrames();
  expect(card.style.getPropertyValue("--tilt-x")).toBe("0.00deg");

  pointer(frame, "pointerleave", 500, 100);
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
});

it("dips PRESS_TILT_DEG further where it is pressed, and lets go on release", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 0, 200); // bottom-left corner
  const corner = `${(-CARD.PRESS_TILT_DEG).toFixed(2)}deg`;
  expect(card.style.getPropertyValue("--press-x")).toBe(corner);
  expect(card.style.getPropertyValue("--press-y")).toBe(corner);

  pointer(frame, "pointerup", 0, 200);
  expect(card.style.getPropertyValue("--press-x")).toBe("");
  expect(spinOf(card)).toBe(0);
});

it("spins on a horizontal drag past the threshold, ignoring vertical movement", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 200, 100);
  pointer(frame, "pointermove", 200, 100 + CARD.DRAG_THRESHOLD_PX + 20); // straight down
  expect(card.dataset.dragging).toBe("");
  expect(spinOf(card)).toBe(0);
  expect(card.style.getPropertyValue("--press-x")).toBe("");
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");

  pointer(frame, "pointermove", 300, 140);
  expect(spinOf(card)).toBeCloseTo(100 * CARD.DRAG_DEG_PER_PX);
});

it("snaps to the nearest face after a slow release", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 100, 100);
  pointer(frame, "pointermove", 110, 100, { timeStamp: 0 });
  pointer(frame, "pointermove", 330, 100, { timeStamp: 1000 }); // 220px: about 115°
  pointer(frame, "pointerup", 330, 100, { timeStamp: 2000 }); // held still: no inertia

  expect(card.dataset.spin).toBe("snap");
  expect(spinOf(card)).toBe(180);
  finishTransition(card);
  expect(card.dataset.spin).toBeUndefined();
  expect(spinOf(card)).toBe(180);
});

it("carries a fling on with inertia before snapping", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 100, 100, { timeStamp: 0 });
  pointer(frame, "pointermove", 110, 100, { timeStamp: 0 });
  pointer(frame, "pointermove", 150, 100, { timeStamp: 16 }); // fast: 20° in a frame
  pointer(frame, "pointerup", 150, 100, { timeStamp: 20 });

  const released = spinOf(card);
  flushFrames();
  expect(card.dataset.spin).toBe("snap");
  expect(spinOf(card) % 180).toBe(0);
  expect(spinOf(card)).toBeGreaterThan(released);
});

it("turns home from the back after resting there with the pointer off the card", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 100, 100);
  pointer(frame, "pointermove", 110, 100, { timeStamp: 0 });
  pointer(frame, "pointermove", 480, 100, { timeStamp: 1000 }); // off the card, dragging right
  pointer(frame, "pointerup", 480, 100, { timeStamp: 2000 });
  finishTransition(card);
  expect(spinOf(card)).toBe(180);

  // Released off the card, so the timer runs.
  act(() => vi.advanceTimersByTime(CARD.BACK_IDLE_MS - 1));
  expect(card.dataset.spin).toBeUndefined();
  act(() => vi.advanceTimersByTime(1));
  expect(card.dataset.spin).toBe("return");
  expect(spinOf(card)).toBe(360); // on in the direction of the last spin
  finishTransition(card);
  expect(spinOf(card)).toBe(0);
});

it("keeps the back up while the pointer rests on the card", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 100, 100);
  pointer(frame, "pointermove", 110, 100, { timeStamp: 0 });
  pointer(frame, "pointermove", 330, 100, { timeStamp: 1000 });
  pointer(frame, "pointerup", 330, 100, { timeStamp: 2000 }); // released over the card
  finishTransition(card);

  act(() => vi.advanceTimersByTime(CARD.BACK_IDLE_MS * 3));
  expect(card.dataset.spin).toBeUndefined();
  expect(spinOf(card)).toBe(180);

  pointer(frame, "pointerleave", 500, 100);
  act(() => vi.advanceTimersByTime(CARD.BACK_IDLE_MS));
  expect(card.dataset.spin).toBe("return");
});

it("never tilts for touch or pen, which have no hover", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointermove", 400, 0, { pointerType: "touch" });
  pointer(frame, "pointermove", 400, 0, { pointerType: "pen" });
  flushFrames();
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
});

it("presses and spins on a sideways swipe", () => {
  const { card, frame } = renderCard();
  const touch = { pointerType: "touch" };
  pointer(frame, "pointerdown", 400, 0, touch);
  expect(card.style.getPropertyValue("--press-x")).not.toBe("");

  pointer(frame, "pointermove", 420, 4, touch); // mostly sideways
  expect(card.dataset.dragging).toBe("");
  expect(card.style.getPropertyValue("--press-x")).toBe("");
  pointer(frame, "pointermove", 520, 30, touch);
  expect(spinOf(card)).toBeCloseTo(100 * CARD.DRAG_DEG_PER_PX);
});

it("leaves a swipe up or down to the page, without spinning", () => {
  const { card, frame } = renderCard();
  const touch = { pointerType: "touch" };
  pointer(frame, "pointerdown", 200, 100, touch);
  pointer(frame, "pointermove", 204, 120, touch); // mostly down
  expect(card.dataset.dragging).toBeUndefined();
  expect(card.style.getPropertyValue("--press-x")).toBe("");

  pointer(frame, "pointermove", 300, 120, touch); // a later sideways drift stays the page's
  expect(spinOf(card)).toBe(0);
  pointer(frame, "pointercancel", 300, 120, touch); // the browser takes it to scroll
  expect(spinOf(card)).toBe(0);
});

it("turns home from the back once the finger lifts, even over the card", () => {
  const { card, frame } = renderCard();
  const touch = (timeStamp: number) => ({ pointerType: "touch", timeStamp });
  pointer(frame, "pointerdown", 50, 100, touch(0));
  pointer(frame, "pointermove", 60, 100, touch(0));
  pointer(frame, "pointermove", 340, 100, touch(1000)); // 140°, inside the card
  pointer(frame, "pointerup", 340, 100, touch(2000));
  finishTransition(card);
  expect(spinOf(card)).toBe(180);

  act(() => vi.advanceTimersByTime(CARD.BACK_IDLE_MS));
  expect(card.dataset.spin).toBe("return");
});

it("follows one finger at a time", () => {
  const { card, frame } = renderCard();
  pointer(frame, "pointerdown", 200, 100, { pointerType: "touch" });
  pointer(frame, "pointerdown", 300, 100, { pointerType: "touch", pointerId: 2, isPrimary: false });
  pointer(frame, "pointermove", 380, 100, { pointerType: "touch", pointerId: 2, isPrimary: false });
  expect(card.dataset.dragging).toBeUndefined();
  expect(spinOf(card)).toBe(0);
});

it("stays fully static under reduced motion", () => {
  matches = { "(prefers-reduced-motion: no-preference)": false };
  const { card, front, frame } = renderCard();
  pointer(frame, "pointermove", 400, 0);
  pointer(frame, "pointerdown", 400, 0, { pointerType: "touch" });
  pointer(frame, "pointermove", 300, 0, { pointerType: "touch" });
  flushFrames();
  expect(card.style.getPropertyValue("--tilt-x")).toBe("");
  expect(card.style.getPropertyValue("--press-x")).toBe("");
  expect(spinOf(card)).toBe(0);
  expect(frame.className).not.toContain("touch-pan-y");
  expect(card.querySelector('[data-slot="membership-card-back"]')).toBeNull();
  expect(front.querySelector('[data-slot="dither-glint"]')).toBeNull();
});
