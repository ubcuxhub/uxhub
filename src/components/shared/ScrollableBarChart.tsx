"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import "./scrollable-bar-chart.css";

export interface ChartPeriod {
  id: string; label: string; count: number | null;
  coverage: "complete" | "partial" | "unavailable" | "future";
}

export function chartPeriodValue(period: Pick<ChartPeriod, "count" | "coverage">, showPartialCoverage = true) {
  if (period.coverage === "future") return "Not yet reported";
  if (period.coverage === "unavailable" || period.count === null) return "Data unavailable";
  return `${period.count.toLocaleString("en-CA")}${showPartialCoverage && period.coverage === "partial" ? " · Incomplete coverage" : ""}`;
}

/** Native, draggable horizontal scrollbar. No wheel/zoom capture or animation. */
export function ScrollableBarChart({ periods, label, wideLabels = false, initialScroll = "end", showPartialCoverage = true }: {
  periods: ChartPeriod[]; label: string; wideLabels?: boolean; initialScroll?: "start" | "end"; showPartialCoverage?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [active, setActive] = useState<string | null>(null);
  const periodKey = periods.map((period) => period.id).join(":");
  const activePeriod = periods.find((period) => period.id === active);
  const coverageNote = [
    periods.some((period) => period.coverage === "unavailable") && "Data unavailable (—)",
    showPartialCoverage && periods.some((period) => period.coverage === "partial") && "* Incomplete coverage",
    periods.some((period) => period.coverage === "future") && "Not yet reported (·)",
  ].filter(Boolean).join(" · ");
  const maximum = Math.max(1, ...periods.map((period) => period.count ?? 0));
  function measure() {
    const el = viewport.current;
    if (el) setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    el.scrollLeft = initialScroll === "start" ? 0 : el.scrollWidth;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [periodKey, initialScroll]);
  function step(direction: number) {
    const el = viewport.current;
    const first = el?.firstElementChild?.firstElementChild as HTMLElement | undefined;
    if (el && first) { el.scrollLeft += direction * (first.offsetWidth + 14); measure(); }
  }
  return <div className="min-w-0">
    <div className="flex min-w-0 items-center gap-1">
      <IconButton label="Earlier periods" variant="ghost" size="icon-sm" disabled={edges.start} onClick={() => step(-1)}><ChevronLeft /></IconButton>
      <div ref={viewport} role="group" aria-label={label} onScroll={measure}
        className="statistics-scrollbar min-w-0 flex-1 overflow-x-auto pb-2.5"
        style={{ "--bar-min-width": wideLabels ? "82px" : "44px" } as CSSProperties}>
        <div className="flex min-w-full gap-3.5">
          {periods.map((period) => {
            const shown = active === period.id;
            const reported = period.count !== null && period.coverage !== "future" && period.coverage !== "unavailable";
            return <button type="button" key={period.id} aria-label={`${period.label}: ${chartPeriodValue(period, showPartialCoverage)}`}
              onMouseEnter={() => setActive(period.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(period.id)} onBlur={() => setActive(null)} onClick={() => setActive(period.id)}
              className="group flex h-[132px] min-w-0 shrink-0 flex-col items-center justify-end gap-0.5 rounded-sm focus-visible:focus-ring"
              style={{ width: "max(var(--bar-min-width), calc((100% - 84px) / 7))" }}>
              <span aria-hidden="true" className={cn("flex h-28 w-full flex-col items-center justify-end gap-1", !reported && "text-muted-foreground")}>
                <span className={cn("max-w-full break-words text-badge text-primary", !shown && "invisible")}>
                  {reported ? `${period.count!.toLocaleString("en-CA")}${showPartialCoverage && period.coverage === "partial" ? "*" : ""}` : "—"}
                </span>
                {reported ? <span data-bar={period.id} className={cn("block w-7 shrink-0 rounded-sm bg-border-subtle", shown && "bg-primary")}
                  style={{ height: `${Math.max(2, (period.count! / maximum) * 90)}px` }} /> : <span className="flex h-12 w-7 items-center justify-center rounded-sm border border-dashed border-border text-small">{period.coverage === "future" ? "·" : "—"}</span>}
              </span>
              <span aria-hidden="true" className="w-full whitespace-nowrap text-center text-label font-normal text-muted-foreground">{period.label}{showPartialCoverage && period.coverage === "partial" ? "*" : ""}</span>
            </button>;
          })}
        </div>
      </div>
      <IconButton label="Later periods" variant="ghost" size="icon-sm" disabled={edges.end} onClick={() => step(1)}><ChevronRight /></IconButton>
    </div>
    <p role="status" className="mt-1 min-h-4 break-words text-badge text-muted-foreground">
      {activePeriod ? `${activePeriod.label}: ${chartPeriodValue(activePeriod, showPartialCoverage)}` : coverageNote || "\u00a0"}
    </p>
    <ul aria-label={`${label} data`} className="sr-only">{periods.map((p) => <li key={p.id}>{p.label}: {chartPeriodValue(p, showPartialCoverage)}</li>)}</ul>
  </div>;
}
