"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { initialChartWindow, panChartWindow, zoomChartWindow } from "@/features/admin/lib/chart-window";

export function useChartWindow(total: number) {
  const [window, setWindow] = useState(() => initialChartWindow(total));
  const chartRef = useRef<HTMLDivElement>(null);
  const wheelAt = useRef(-Infinity);

  function pan(offset: number) {
    setWindow((current) => panChartWindow(current, total, offset));
  }

  function zoom(delta: number) {
    setWindow((current) => zoomChartWindow(current, total, delta));
  }

  function reset() {
    setWindow(initialChartWindow(total));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    event.stopPropagation();
    pan(event.key === "ArrowLeft" ? -1 : 1);
  }

  // React's delegated wheel listener is passive. Only the chart surface owns
  // a non-passive listener, and page scrolling resumes at either zoom limit.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || total === 0) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
      const delta = event.deltaY < 0 ? -1 : 1;
      if ((delta < 0 && window.size <= 1) || (delta > 0 && window.size >= total)) return;

      event.preventDefault();
      const now = performance.now();
      if (now - wheelAt.current < 80) return;
      wheelAt.current = now;
      const bounds = chart.getBoundingClientRect();
      const anchor = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0.5;
      setWindow((current) => zoomChartWindow(current, total, delta, anchor));
    };

    chart.addEventListener("wheel", onWheel, { passive: false });
    return () => chart.removeEventListener("wheel", onWheel);
  }, [total, window.size]);

  return { window, chartRef, onKeyDown, pan, zoom, reset };
}
