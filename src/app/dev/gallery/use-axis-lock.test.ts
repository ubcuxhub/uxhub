import { describe, expect, it } from "vitest";

import {
  GESTURE_IDLE_MS,
  NO_LOCK,
  dominantAxis,
  keyMove,
  lockWheel,
  panAxis,
  wheelDelta,
} from "./use-axis-lock";

const PAGE = { width: 1000, height: 800 };

describe("dominantAxis", () => {
  it("follows the larger movement", () => {
    expect(dominantAxis(10, 3)).toBe("x");
    expect(dominantAxis(-10, 3)).toBe("x");
    expect(dominantAxis(2, -9)).toBe("y");
  });

  it("goes vertical on a tie and has no axis without movement", () => {
    expect(dominantAxis(5, 5)).toBe("y");
    expect(dominantAxis(0, 0)).toBeNull();
  });
});

describe("wheelDelta", () => {
  const event = { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false };

  it("passes pixel deltas through", () => {
    expect(wheelDelta({ ...event, deltaX: 3, deltaY: 40 }, PAGE)).toEqual({ dx: 3, dy: 40 });
  });

  it("scales line and page deltas", () => {
    expect(wheelDelta({ ...event, deltaY: 3, deltaMode: 1 }, PAGE)).toEqual({ dx: 0, dy: 48 });
    expect(wheelDelta({ ...event, deltaX: 1, deltaMode: 2 }, PAGE)).toEqual({ dx: 1000, dy: 0 });
  });

  it("turns a shifted vertical wheel sideways", () => {
    expect(wheelDelta({ ...event, deltaY: 40, shiftKey: true }, PAGE)).toEqual({ dx: 40, dy: 0 });
    // Browsers that already swapped the axes.
    expect(wheelDelta({ ...event, deltaX: 40, shiftKey: true }, PAGE)).toEqual({ dx: 40, dy: 0 });
  });
});

describe("lockWheel", () => {
  it("takes the axis of a gesture's first movement", () => {
    expect(lockWheel(NO_LOCK, 2, 30, 0).axis).toBe("y");
    expect(lockWheel(NO_LOCK, 30, 2, 0).axis).toBe("x");
  });

  it("holds the axis while the gesture continues, however it drifts", () => {
    let lock = lockWheel(NO_LOCK, 2, 30, 0);
    lock = lockWheel(lock, 50, 1, 40);
    lock = lockWheel(lock, 80, 0, 80);
    expect(lock.axis).toBe("y");
  });

  it("starts a new gesture after the idle gap", () => {
    let lock = lockWheel(NO_LOCK, 2, 30, 0);
    lock = lockWheel(lock, 40, 2, 100);
    expect(lock.axis).toBe("y");
    lock = lockWheel(lock, 40, 2, 100 + GESTURE_IDLE_MS);
    expect(lock.axis).toBe("x");
  });

  it("waits for movement to pick an axis", () => {
    const lock = lockWheel(NO_LOCK, 0, 0, 0);
    expect(lock.axis).toBeNull();
    expect(lockWheel(lock, 12, 1, 10).axis).toBe("x");
  });
});

describe("panAxis", () => {
  it("waits for the threshold, then locks to the dominant axis", () => {
    expect(panAxis(3, 2)).toBeNull();
    expect(panAxis(20, 12)).toBe("x");
    expect(panAxis(-4, -18)).toBe("y");
  });
});

describe("keyMove", () => {
  it("steps one axis with the arrows", () => {
    expect(keyMove("ArrowRight", false, PAGE)).toEqual({ axis: "x", by: 64 });
    expect(keyMove("ArrowUp", false, PAGE)).toEqual({ axis: "y", by: -64 });
  });

  it("pages vertically, or sideways with Shift", () => {
    expect(keyMove("PageDown", false, PAGE)).toEqual({ axis: "y", by: 680 });
    expect(keyMove("PageUp", true, PAGE)).toEqual({ axis: "x", by: -850 });
    expect(keyMove("End", false, PAGE)).toEqual({ axis: "y", to: "end" });
    expect(keyMove("Home", true, PAGE)).toEqual({ axis: "x", to: "start" });
  });

  it("ignores other keys", () => {
    expect(keyMove("a", false, PAGE)).toBeNull();
    expect(keyMove(" ", false, PAGE)).toBeNull();
  });
});
