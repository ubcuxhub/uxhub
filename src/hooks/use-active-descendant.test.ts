// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it } from "vitest";

import { useActiveDescendant } from "./use-active-descendant";

function press(
  result: { current: ReturnType<typeof useActiveDescendant> },
  key: string,
) {
  const event = { key, preventDefault: () => {} } as unknown as KeyboardEvent;
  act(() => result.current.onKeyDown(event));
}

describe("useActiveDescendant", () => {
  it("starts with nothing active", () => {
    const { result } = renderHook(() => useActiveDescendant(3));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("moves with the arrows and stops at the ends", () => {
    const { result } = renderHook(() => useActiveDescendant(3));
    press(result, "ArrowDown");
    expect(result.current.activeIndex).toBe(0);
    press(result, "ArrowDown");
    press(result, "ArrowDown");
    press(result, "ArrowDown");
    expect(result.current.activeIndex).toBe(2);
    press(result, "ArrowUp");
    press(result, "ArrowUp");
    press(result, "ArrowUp");
    expect(result.current.activeIndex).toBe(0);
  });

  it("wraps when asked to", () => {
    const { result } = renderHook(() => useActiveDescendant(3, { loop: true }));
    press(result, "ArrowUp");
    expect(result.current.activeIndex).toBe(2);
    press(result, "ArrowDown");
    expect(result.current.activeIndex).toBe(0);
  });

  it("jumps with Home and End unless they are turned off", () => {
    const { result } = renderHook(() => useActiveDescendant(5));
    press(result, "End");
    expect(result.current.activeIndex).toBe(4);
    press(result, "Home");
    expect(result.current.activeIndex).toBe(0);

    const off = renderHook(() => useActiveDescendant(5, { homeEnd: false }));
    press(off.result, "End");
    expect(off.result.current.activeIndex).toBe(-1);
  });

  it("ignores keys on an empty list and clamps a shrinking one", () => {
    const empty = renderHook(() => useActiveDescendant(0));
    press(empty.result, "ArrowDown");
    expect(empty.result.current.activeIndex).toBe(-1);

    const { result, rerender } = renderHook(({ count }) => useActiveDescendant(count), {
      initialProps: { count: 5 },
    });
    press(result, "End");
    expect(result.current.activeIndex).toBe(4);
    rerender({ count: 2 });
    expect(result.current.activeIndex).toBe(-1);
  });

  it("gives each option a stable, distinct id", () => {
    const { result } = renderHook(() => useActiveDescendant(2));
    expect(result.current.getOptionId(0)).not.toBe(result.current.getOptionId(1));
    expect(result.current.getOptionId(1)).toBe(result.current.getOptionId(1));
  });
});
