// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import DotGrid from "./DotGrid";

let frames: FrameRequestCallback[] = [];
let reducedMotion = false;
const ctx = {
  clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), arc: vi.fn(), fill: vi.fn(), scale: vi.fn(),
  fillStyle: "",
};

/** Runs the frames queued so far; returns how many ran. */
function flushFrames() {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((frame) => frame(performance.now())));
  return queued.length;
}

beforeEach(() => {
  frames = [];
  reducedMotion = false;
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion") && reducedMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

const move = (x: number, y: number) =>
  act(() => { window.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y })); });

it("draws once and then stops while nothing moves", () => {
  render(<DotGrid dotSize={6} gap={40} />);
  expect(flushFrames()).toBe(1);
  expect(ctx.fill).toHaveBeenCalled();
  expect(flushFrames()).toBe(0);
});

it("draws again when the pointer moves, then stops", () => {
  render(<DotGrid dotSize={6} gap={40} speedTrigger={Infinity} />);
  flushFrames();
  ctx.clearRect.mockClear();
  move(20, 20);
  expect(flushFrames()).toBe(1);
  expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  expect(flushFrames()).toBe(0);
});

it("doesn't draw in a hidden tab", () => {
  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  render(<DotGrid />);
  expect(flushFrames()).toBe(0);
});

it("is a still grid under reduced motion, ignoring the pointer", () => {
  reducedMotion = true;
  render(<DotGrid dotSize={6} gap={40} />);
  expect(flushFrames()).toBe(1);
  move(20, 20);
  act(() => { window.dispatchEvent(new MouseEvent("click", { clientX: 20, clientY: 20 })); });
  expect(flushFrames()).toBe(0);
});
