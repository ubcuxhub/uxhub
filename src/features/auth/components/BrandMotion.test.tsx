// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandMotion,
  FINE_POINTER_QUERY,
  REDUCED_MOTION_QUERY,
} from "./BrandMotion";
import { BRAND_SHAPES } from "./brand-shapes";

type Listener = () => void;

/** A matchMedia whose answers the test sets, and can change later. */
function stubMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<Listener>>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return state[query] ?? false;
      },
      media: query,
      addEventListener: (_: string, fn: Listener) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(fn);
      },
      removeEventListener: (_: string, fn: Listener) => {
        listeners.get(query)?.delete(fn);
      },
    })),
  );
  return (query: string, matches: boolean) => {
    state[query] = matches;
    act(() => listeners.get(query)?.forEach((fn) => fn()));
  };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function renderInPanel() {
  const { container } = render(
    <div data-testid="panel">
      <BrandMotion />
    </div>,
  );
  const root = container.querySelector("[data-slot=brand-motion]") as HTMLElement;
  return {
    panel: container.firstElementChild as HTMLElement,
    root,
    glow: () => root.querySelector("[data-slot=cursor-glow]") as HTMLElement | null,
  };
}

beforeEach(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BrandMotion", () => {
  it("is decorative: hidden from assistive tech and never takes the pointer", () => {
    stubMatchMedia({});
    const { root } = renderInPanel();
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.className).toContain("pointer-events-none");
    for (const img of root.querySelectorAll("img")) {
      expect(img.getAttribute("alt")).toBe("");
    }
  });

  it("renders every shape tile in Figma's layer order", () => {
    stubMatchMedia({});
    const { root } = renderInPanel();
    const shapes = [...root.querySelectorAll<HTMLElement>("[data-shape]")];
    expect(shapes.map((shape) => shape.dataset.shape)).toEqual(
      BRAND_SHAPES.map((shape) => shape.name),
    );
  });

  it("plays the fall with full motion", () => {
    stubMatchMedia({ [REDUCED_MOTION_QUERY]: false });
    const { root } = renderInPanel();
    expect(root.dataset.motion).toBe("full");
  });

  it("shows the settled still frame and no glow with reduced motion", () => {
    stubMatchMedia({ [REDUCED_MOTION_QUERY]: true, [FINE_POINTER_QUERY]: true });
    const { root, glow } = renderInPanel();
    expect(root.dataset.motion).toBe("reduce");
    expect(root.querySelectorAll("[data-shape]")).toHaveLength(BRAND_SHAPES.length);
    expect(glow()).toBeNull();
  });

  it("switches to the still frame when reduced motion turns on", () => {
    const set = stubMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { root, glow } = renderInPanel();
    expect(glow()).not.toBeNull();

    set(REDUCED_MOTION_QUERY, true);

    expect(root.dataset.motion).toBe("reduce");
    expect(glow()).toBeNull();
  });

  it("adds the cursor glow only for a fine, hovering pointer", () => {
    stubMatchMedia({ [FINE_POINTER_QUERY]: true });
    expect(renderInPanel().glow()).not.toBeNull();
    cleanup();

    stubMatchMedia({ [FINE_POINTER_QUERY]: false });
    expect(renderInPanel().glow()).toBeNull();
  });

  it("fades the glow in over the panel and out when the pointer leaves", () => {
    stubMatchMedia({ [FINE_POINTER_QUERY]: true });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { panel, glow } = renderInPanel();
    expect(glow()!.style.opacity).toBe("0");

    panel.dispatchEvent(pointer("pointerenter", "mouse", 120, 200));
    expect(glow()!.style.opacity).toBe("1");
    const lead = glow()!.firstElementChild as HTMLElement;
    expect(lead.style.transform).toContain("translate3d(40px, 120px, 0)");

    panel.dispatchEvent(pointer("pointerleave", "mouse", 0, 0));
    expect(glow()!.style.opacity).toBe("0");
  });

  it("ignores touch pointers", () => {
    stubMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { panel, glow } = renderInPanel();
    panel.dispatchEvent(pointer("pointerenter", "touch", 120, 200));
    expect(glow()!.style.opacity).toBe("0");
  });

  it("pauses while the tab is hidden and resumes when it's back", () => {
    stubMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { root, panel, glow } = renderInPanel();
    expect(root.hasAttribute("data-paused")).toBe(false);

    setHidden(true);
    expect(root.hasAttribute("data-paused")).toBe(true);
    // The glow stops listening while hidden.
    panel.dispatchEvent(pointer("pointerenter", "mouse", 10, 10));
    expect(glow()!.style.opacity).toBe("0");

    setHidden(false);
    expect(root.hasAttribute("data-paused")).toBe(false);
    panel.dispatchEvent(pointer("pointerenter", "mouse", 10, 10));
    expect(glow()!.style.opacity).toBe("1");
  });
});

/** jsdom has no PointerEvent; a MouseEvent with `pointerType` stands in. */
function pointer(type: string, pointerType: string, x: number, y: number) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: false });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}
