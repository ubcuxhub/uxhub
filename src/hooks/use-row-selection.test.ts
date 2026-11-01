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

  it("keeps selected ids that are not currently visible", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRowSelection<string>(ids),
      { initialProps: { ids: [...IDS] as string[] } },
    );
    act(() => result.current.toggleAll());
    expect(result.current.selected.size).toBe(4);

    // Narrower results (a search, or server paging): the hidden rows stay.
    rerender({ ids: ["a", "b"] });
    expect(result.current.selected.size).toBe(4);
    expect(result.current.allState).toBe(true);

    rerender({ ids: [...IDS] });
    expect([...result.current.selected]).toEqual([...IDS]);
    expect(result.current.allState).toBe(true);
  });

  it("survives currentIds going to [] and back", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRowSelection<string>(ids),
      { initialProps: { ids: [...IDS] as string[] } },
    );
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("c"));

    rerender({ ids: [] });
    expect(result.current.selected.size).toBe(2);
    expect(result.current.allState).toBe(false);

    rerender({ ids: [...IDS] });
    expect([...result.current.selected].sort()).toEqual(["a", "c"]);
    expect(result.current.allState).toBe("indeterminate");
  });

  it("toggleAll applies to the current results and leaves hidden picks alone", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRowSelection<string>(ids),
      { initialProps: { ids: ["a", "b"] as string[] } },
    );
    act(() => result.current.toggleAll());
    // Page 2: a different set of ids.
    rerender({ ids: ["c", "d"] });
    expect(result.current.allState).toBe(false);
    expect(result.current.selected.size).toBe(2);

    act(() => result.current.toggleAll());
    expect([...result.current.selected].sort()).toEqual(["a", "b", "c", "d"]);
    expect(result.current.allState).toBe(true);

    act(() => result.current.toggleAll());
    expect([...result.current.selected].sort()).toEqual(["a", "b"]);
  });

  it("exports the selection, hidden rows included, else the current results", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRowSelection<string>(ids),
      { initialProps: { ids: ["a", "b"] as string[] } },
    );
    act(() => result.current.toggle("b"));
    rerender({ ids: ["c", "d"] });
    act(() => result.current.toggle("d"));
    expect(result.current.exportIds).toEqual(["d", "b"]);

    act(() => result.current.clear());
    expect(result.current.exportIds).toEqual(["c", "d"]);
  });

  it("applies several toggles made in one handler", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => {
      ["a", "b", "c"].forEach(result.current.toggle);
    });
    expect([...result.current.selected]).toEqual(["a", "b", "c"]);

    act(() => {
      result.current.toggle("a");
      result.current.toggle("a");
      result.current.toggle("b");
    });
    expect([...result.current.selected]).toEqual(["c", "a"]);
  });

  it("toggleAll reads the latest state, not the render's", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => {
      result.current.toggleAll();
      result.current.toggleAll();
    });
    expect(result.current.selected.size).toBe(0);

    act(() => {
      result.current.toggle("a");
      result.current.toggleAll();
    });
    expect(result.current.allState).toBe(true);
  });

  it("setSelected replaces the selection", () => {
    const { result } = renderHook(() => useRowSelection<string>(IDS));
    act(() => result.current.toggle("a"));
    act(() => result.current.setSelected(["c", "d"]));
    expect([...result.current.selected]).toEqual(["c", "d"]);
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
