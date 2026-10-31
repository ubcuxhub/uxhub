// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRowSelection } from "./use-row-selection";

const IDS = ["a", "b", "c", "d"] as const;

describe("useRowSelection", () => {
  it("starts empty, and exports every current result", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    expect(result.current.selected.size).toBe(0);
    expect(result.current.allState).toBe(false);
    expect(result.current.exportIds).toEqual(IDS);
  });

  it("toggles a row and reports indeterminate", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => result.current.toggle("b"));
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.allState).toBe("indeterminate");
    expect(result.current.exportIds).toEqual(["b"]);

    act(() => result.current.toggle("b"));
    expect(result.current.allState).toBe(false);
  });

  it("toggleAll selects the current results, then clears them", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => result.current.toggleAll());
    expect(result.current.allState).toBe(true);
    expect([...result.current.selected]).toEqual([...IDS]);

    act(() => result.current.toggleAll());
    expect(result.current.selected.size).toBe(0);
  });

  it("toggleAll from a partial selection selects everything", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => result.current.toggle("a"));
    act(() => result.current.toggleAll());
    expect(result.current.allState).toBe(true);
  });

  it("acts on the current results only and prunes when they change", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRowSelection<string>(ids),
      { initialProps: { ids: [...IDS] as string[] } },
    );
    act(() => result.current.toggleAll());
    expect(result.current.selected.size).toBe(4);

    rerender({ ids: ["a", "b"] });
    expect(result.current.selected.size).toBe(2);
    expect(result.current.allState).toBe(true);

    // A row that was filtered out does not come back selected.
    rerender({ ids: [...IDS] });
    expect([...result.current.selected]).toEqual(["a", "b"]);
    expect(result.current.allState).toBe("indeterminate");
  });

  it("clear empties the selection", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => result.current.toggleAll());
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.exportIds).toEqual(IDS);
  });

  it("is never 'all' for an empty list", () => {
    const { result } = renderHook(() => useRowSelection<string>([]));
    expect(result.current.allState).toBe(false);
    act(() => result.current.toggleAll());
    expect(result.current.allState).toBe(false);
  });
});
