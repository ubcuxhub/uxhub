"use client";

import { useState, type KeyboardEvent } from "react";
import { initialChartWindow, panChartWindow, zoomChartWindow } from "@/features/admin/lib/chart-window";

export function useChartWindow(total: number) {
  const [window, setWindow] = useState(() => initialChartWindow(total));

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

  return { window, onKeyDown, pan, zoom, reset };
}
