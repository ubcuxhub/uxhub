"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { COLUMNS, columnOf } from "./_compositions";
import { scrollBehavior, useAxisLockedScroll } from "./use-axis-lock";

/** At and above this width the canvas scrolls both ways; below it is one column. */
const CANVAS_QUERY = "(min-width: 768px)";

function subscribeCanvas(onChange: () => void) {
  const query = window.matchMedia(CANVAS_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useCanvas() {
  return useSyncExternalStore(
    subscribeCanvas,
    () => window.matchMedia(CANVAS_QUERY).matches,
    () => false,
  );
}

/**
 * The Gallery: six fixed-width columns of compositions on a dot grid. It
 * overflows the window both ways, and each gesture scrolls one axis only
 * (`useAxisLockedScroll`). Phones get one column in ordinary page flow.
 */
function Gallery() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvas = useCanvas();
  const [away, setAway] = useState(false);
  useAxisLockedScroll(canvasRef, canvas);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !canvas) return;
    const update = () => setAway(el.scrollLeft > 8 || el.scrollTop > 8);
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, [canvas]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={canvasRef}
        role="region"
        aria-label="Gallery canvas. Arrow keys scroll it; Shift with Page Up, Page Down, Home or End moves sideways."
        tabIndex={canvas ? 0 : undefined}
        className="relative min-h-0 flex-1 bg-section bg-[radial-gradient(var(--color-border)_1px,transparent_1.5px)] bg-size-[20px_20px] bg-local outline-none focus-visible:focus-ring focus-visible:-outline-offset-2 md:cursor-grab md:overflow-auto md:overscroll-contain md:[scrollbar-width:thin] data-panning:cursor-grabbing data-panning:select-none"
      >
        <div className="flex flex-col gap-4 px-4 py-6 md:w-max md:flex-row md:items-start md:gap-6 md:p-10">
          {COLUMNS.map((column) => (
            <div
              key={column}
              data-column={column}
              className="flex w-full min-w-0 flex-col gap-4 md:w-[360px] md:gap-6"
            >
              {columnOf(column).map(({ id, Component }) => (
                <div
                  key={id}
                  data-pan-item
                  data-composition={id}
                  className="min-w-0 cursor-auto"
                >
                  <Component />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {canvas && away ? (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-6 bottom-6 shadow-overlay"
          onClick={() =>
            canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: scrollBehavior() })
          }
        >
          <ArrowUpLeft aria-hidden />
          Back to start
        </Button>
      ) : null}
    </div>
  );
}

export default Gallery;
