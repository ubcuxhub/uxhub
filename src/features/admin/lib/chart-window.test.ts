import { describe, expect, it } from "vitest";
import { initialChartWindow, panChartWindow, zoomChartWindow } from "./chart-window";

describe("event chart range", () => {
  it("starts with the latest six events and handles short and empty series", () => {
    expect(initialChartWindow(20)).toEqual({ start: 14, size: 6 });
    expect(initialChartWindow(2)).toEqual({ start: 0, size: 2 });
    expect(initialChartWindow(0)).toEqual({ start: 0, size: 0 });
  });
  it("clamps panning at both ends", () => {
    expect(panChartWindow({ start: 0, size: 6 }, 20, -1).start).toBe(0);
    expect(panChartWindow({ start: 14, size: 6 }, 20, 1).start).toBe(14);
    expect(panChartWindow({ start: 5, size: 6 }, 20, -1).start).toBe(4);
  });
  it("zooms around the pointer and clamps to one event or the entire series", () => {
    expect(zoomChartWindow({ start: 4, size: 6 }, 20, -2, 1)).toEqual({ start: 6, size: 4 });
    expect(zoomChartWindow({ start: 4, size: 6 }, 20, -2, 0)).toEqual({ start: 4, size: 4 });
    expect(zoomChartWindow({ start: 19, size: 1 }, 20, -1)).toEqual({ start: 19, size: 1 });
    expect(zoomChartWindow({ start: 14, size: 6 }, 20, 100)).toEqual({ start: 0, size: 20 });
    expect(zoomChartWindow({ start: 0, size: 0 }, 0, 1)).toEqual({ start: 0, size: 0 });
  });
});
