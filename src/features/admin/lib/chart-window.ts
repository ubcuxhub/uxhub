export interface ChartWindow { start: number; size: number }

export function initialChartWindow(total: number): ChartWindow {
  const size = Math.min(6, total);
  return { start: total - size, size };
}

export function panChartWindow(window: ChartWindow, total: number, offset: number): ChartWindow {
  return { ...window, start: Math.max(0, Math.min(total - window.size, window.start + offset)) };
}

/** Keep the event under the pointer in the same relative position on zoom. */
export function zoomChartWindow(window: ChartWindow, total: number, delta: number, anchor = 0.5): ChartWindow {
  if (total === 0) return window;
  const size = Math.max(1, Math.min(total, window.size + delta));
  const ratio = Math.max(0, Math.min(1, anchor));
  const start = Math.round(window.start + ratio * (window.size - size));
  return { size, start: Math.max(0, Math.min(total - size, start)) };
}
