"use client";

import { useEffect, type RefObject } from "react";

/**
 * Axis-locked scrolling for a two-way canvas: a gesture moves it along one
 * axis only, like ui.shadcn.com/create. The decisions are pure functions so
 * they can be tested without a browser; `useAxisLockedScroll` wires them to
 * wheel, keyboard, touch and background-drag input.
 */

export type Axis = "x" | "y";

/** Quiet time that ends a wheel gesture. Trackpad momentum stays inside it. */
export const GESTURE_IDLE_MS = 150;
/** How far a finger or a background drag moves before its axis is decided. */
export const PAN_THRESHOLD_PX = 6;
/** One line of a line-mode wheel (a mouse in Firefox). */
const LINE_PX = 16;
/** Arrow-key step. */
const ARROW_PX = 64;

/**
 * The axis a movement mostly follows, or null for no movement. A tie goes
 * vertical, the canvas's main direction.
 */
export function dominantAxis(dx: number, dy: number): Axis | null {
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** A wheel event's movement in pixels. Shift turns a vertical wheel sideways. */
export function wheelDelta(
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey">,
  page: { width: number; height: number },
): { dx: number; dy: number } {
  const [scaleX, scaleY] =
    event.deltaMode === 1
      ? [LINE_PX, LINE_PX]
      : event.deltaMode === 2
        ? [page.width, page.height]
        : [1, 1];
  const dx = event.deltaX * scaleX;
  const dy = event.deltaY * scaleY;
  // Browsers that already swap the axes for shift report dx; the rest report dy.
  if (event.shiftKey) return { dx: dx || dy, dy: 0 };
  return { dx, dy };
}

export interface WheelLock {
  axis: Axis | null;
  /** Time of the last wheel event, in ms. */
  last: number;
}

export const NO_LOCK: WheelLock = { axis: null, last: -Infinity };

/**
 * The lock after one more wheel event. A gesture starts after `idle` ms of
 * quiet and takes the axis of its first movement; within it the axis holds,
 * however the fingers drift.
 */
export function lockWheel(
  lock: WheelLock,
  dx: number,
  dy: number,
  now: number,
  idle = GESTURE_IDLE_MS,
): WheelLock {
  if (lock.axis && now - lock.last < idle) return { axis: lock.axis, last: now };
  return { axis: dominantAxis(dx, dy), last: now };
}

/**
 * The axis of a pan that has moved (dx, dy) from where it started, once it is
 * past the threshold; null until then.
 */
export function panAxis(
  dx: number,
  dy: number,
  threshold = PAN_THRESHOLD_PX,
): Axis | null {
  if (Math.hypot(dx, dy) < threshold) return null;
  return dominantAxis(dx, dy);
}

export type KeyMove =
  | { axis: Axis; by: number }
  | { axis: Axis; to: "start" | "end" };

/**
 * What a key does to the focused canvas: arrows step one axis, Page Up/Down
 * and Home/End move vertically, and with Shift they move sideways.
 */
export function keyMove(
  key: string,
  shiftKey: boolean,
  page: { width: number; height: number },
): KeyMove | null {
  const pageAxis: Axis = shiftKey ? "x" : "y";
  const pageSize = (shiftKey ? page.width : page.height) * 0.85;
  switch (key) {
    case "ArrowLeft":
      return { axis: "x", by: -ARROW_PX };
    case "ArrowRight":
      return { axis: "x", by: ARROW_PX };
    case "ArrowUp":
      return { axis: "y", by: -ARROW_PX };
    case "ArrowDown":
      return { axis: "y", by: ARROW_PX };
    case "PageUp":
      return { axis: pageAxis, by: -pageSize };
    case "PageDown":
      return { axis: pageAxis, by: pageSize };
    case "Home":
      return { axis: pageAxis, to: "start" };
    case "End":
      return { axis: pageAxis, to: "end" };
    default:
      return null;
  }
}

// --- DOM ----------------------------------------------------------------

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Smooth, unless the viewer asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * Whether a scroller inside the canvas, between `target` and `root`, can
 * still move along `axis` in the direction of `amount`. It keeps the gesture,
 * so a long list in a card scrolls on its own.
 */
function innerScrollerTakes(
  target: EventTarget | null,
  root: HTMLElement,
  axis: Axis,
  amount: number,
) {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== root;
    node = node.parentElement
  ) {
    if (!(node instanceof HTMLElement)) continue;
    const style = getComputedStyle(node);
    const overflow = axis === "x" ? style.overflowX : style.overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const position = axis === "x" ? node.scrollLeft : node.scrollTop;
    const room =
      axis === "x"
        ? node.scrollWidth - node.clientWidth
        : node.scrollHeight - node.clientHeight;
    if (room <= 1) continue;
    if (amount > 0 ? position < room - 1 : position > 0) return true;
  }
  return false;
}

/** Touches that belong to a control (a slider, a text field) are left alone. */
const OWN_GESTURES =
  "input, textarea, select, [contenteditable='true'], [role='slider'], [data-pan='off']";

/**
 * Locks `ref`'s scrolling to one axis per gesture while `enabled`:
 *
 * - Wheel and trackpad: the first movement of a gesture picks the axis, which
 *   holds until `GESTURE_IDLE_MS` of quiet. Shift+wheel scrolls sideways.
 *   Pinch-zoom (ctrl+wheel) is left to the browser.
 * - Keyboard, when the canvas itself has focus: see `keyMove`.
 * - Touch: one finger pans along the axis it starts on, with a short glide
 *   after release unless reduced motion is on.
 * - Mouse drag on the background (anything outside `[data-pan-item]`) pans the
 *   same way; cards keep their own clicks and drags.
 *
 * Scrollers inside the canvas keep gestures they can still use.
 */
export function useAxisLockedScroll(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const el: HTMLElement = root;

    let wheel = NO_LOCK;
    let glide = 0;
    const stopGlide = () => cancelAnimationFrame(glide);
    const page = () => ({ width: el.clientWidth, height: el.clientHeight });
    const move = (axis: Axis, amount: number) => {
      if (axis === "x") el.scrollLeft += amount;
      else el.scrollTop += amount;
    };

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey) return;
      const { dx, dy } = wheelDelta(event, page());
      wheel = lockWheel(wheel, dx, dy, event.timeStamp);
      if (!wheel.axis) return;
      const amount = wheel.axis === "x" ? dx : dy;
      if (innerScrollerTakes(event.target, el, wheel.axis, amount)) return;
      event.preventDefault();
      stopGlide();
      move(wheel.axis, amount);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.target !== el || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const action = keyMove(event.key, event.shiftKey, page());
      if (!action) return;
      event.preventDefault();
      stopGlide();
      const behavior = scrollBehavior();
      if ("by" in action) {
        el.scrollBy({
          left: action.axis === "x" ? action.by : 0,
          top: action.axis === "y" ? action.by : 0,
          behavior,
        });
      } else {
        const end =
          action.axis === "x"
            ? el.scrollWidth - el.clientWidth
            : el.scrollHeight - el.clientHeight;
        const to = action.to === "start" ? 0 : end;
        el.scrollTo({
          ...(action.axis === "x" ? { left: to } : { top: to }),
          behavior,
        });
      }
    }

    // One pan at a time, from a finger or a background drag.
    interface Pan {
      startX: number;
      startY: number;
      x: number;
      y: number;
      axis: Axis | null;
      time: number;
      /** px per ms along the axis, for the glide. */
      velocity: number;
    }
    let pan: Pan | null = null;

    const beginPan = (x: number, y: number, time: number) => {
      stopGlide();
      pan = { startX: x, startY: y, x, y, axis: null, time, velocity: 0 };
    };

    /** Moves the canvas for a pointer now at (x, y); false until the axis is known. */
    const continuePan = (x: number, y: number, time: number) => {
      if (!pan) return false;
      if (!pan.axis) {
        pan.axis = panAxis(pan.startX - x, pan.startY - y);
        if (!pan.axis) return false;
        // Catch up on the movement made before the axis was decided.
        pan.x = pan.startX;
        pan.y = pan.startY;
      }
      const amount = pan.axis === "x" ? pan.x - x : pan.y - y;
      move(pan.axis, amount);
      const elapsed = Math.max(1, time - pan.time);
      pan.velocity = 0.8 * (amount / elapsed) + 0.2 * pan.velocity;
      pan.x = x;
      pan.y = y;
      pan.time = time;
      return true;
    };

    const endPan = (withGlide: boolean) => {
      const finished = pan;
      pan = null;
      if (!withGlide || !finished?.axis || prefersReducedMotion()) return;
      const axis = finished.axis;
      let velocity = finished.velocity;
      let previous = performance.now();
      const step = (now: number) => {
        const elapsed = now - previous;
        previous = now;
        velocity *= Math.pow(0.95, elapsed / 16);
        if (Math.abs(velocity) < 0.02) return;
        move(axis, velocity * elapsed);
        glide = requestAnimationFrame(step);
      };
      if (Math.abs(velocity) > 0.1) glide = requestAnimationFrame(step);
    };

    function onTouchStart(event: TouchEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || target?.closest(OWN_GESTURES)) {
        pan = null;
        return;
      }
      const touch = event.touches[0];
      beginPan(touch.clientX, touch.clientY, event.timeStamp);
    }

    function onTouchMove(event: TouchEvent) {
      if (!pan || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const axis =
        pan.axis ?? panAxis(pan.startX - touch.clientX, pan.startY - touch.clientY);
      if (
        axis &&
        !pan.axis &&
        innerScrollerTakes(
          event.target,
          el,
          axis,
          axis === "x" ? pan.startX - touch.clientX : pan.startY - touch.clientY,
        )
      ) {
        // A list inside a card scrolls natively.
        pan = null;
        return;
      }
      // Cancel the browser's own pan from the first move, or it takes over.
      if (event.cancelable) event.preventDefault();
      continuePan(touch.clientX, touch.clientY, event.timeStamp);
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length === 0) endPan(true);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("[data-pan-item]")) return;
      beginPan(event.clientX, event.clientY, event.timeStamp);
      el.setPointerCapture(event.pointerId);
      el.dataset.panning = "true";
    }

    function onPointerMove(event: PointerEvent) {
      if (!pan || event.pointerType !== "mouse") return;
      if (continuePan(event.clientX, event.clientY, event.timeStamp)) {
        event.preventDefault();
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerType !== "mouse" || !pan) return;
      delete el.dataset.panning;
      endPan(false);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      stopGlide();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [ref, enabled]);
}
