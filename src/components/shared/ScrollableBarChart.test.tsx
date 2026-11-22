// @vitest-environment jsdom
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ScrollableBarChart, type ChartPeriod } from "./ScrollableBarChart";

beforeAll(() => { vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollLeft");
afterEach(() => { cleanup(); vi.restoreAllMocks(); if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollLeft", scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollLeft"); });

function mockScrollPosition() {
  let position = 0;
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    get: () => position,
    set: (value: number) => { position = Math.max(0, Math.min(400, value)); },
  });
  return () => position;
}

const periods: ChartPeriod[] = [
  { id: "missing", label: "2022–2023", count: null, coverage: "unavailable" },
  { id: "partial", label: "2023–2024", count: 10, coverage: "partial" },
  { id: "zero", label: "2024–2025", count: 0, coverage: "complete" },
  { id: "complete", label: "2025–2026", count: 20, coverage: "complete" },
  { id: "future", label: "2026–2027", count: null, coverage: "future" },
];

describe("scrollable reporting chart", () => {
  it("reveals equivalent actual counts and coverage on hover, focus and touch/click", () => {
    render(<ScrollableBarChart periods={periods} label="Members" />);
    expect(screen.getByRole("status").textContent).toContain("Data unavailable (—)");
    expect(screen.getByRole("status").textContent).toContain("* Incomplete coverage");
    expect(screen.getByRole("status").textContent).toContain("Not yet reported (·)");
    const partial = screen.getByRole("button", { name: "2023–2024: 10 · Incomplete coverage" });
    fireEvent.mouseEnter(partial);
    expect(screen.getByRole("status").textContent).toBe("2023–2024: 10 · Incomplete coverage");
    fireEvent.mouseLeave(partial);
    const zero = screen.getByRole("button", { name: "2024–2025: 0" });
    fireEvent.focus(zero);
    expect(screen.getByRole("status").textContent).toBe("2024–2025: 0");
    fireEvent.click(screen.getByRole("button", { name: "2026–2027: Not yet reported" }));
    expect(screen.getByRole("status").textContent).toBe("2026–2027: Not yet reported");
    const list = screen.getByRole("list", { name: "Members data" });
    expect(list.textContent).toContain("2022–2023: Data unavailable");
    expect(list.textContent).toContain("2024–2025: 0");
  });

  it("starts at the newest end, steps one period, follows thumb scrolling and disables at boundaries", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(82);
    const position = mockScrollPosition();
    render(<ScrollableBarChart periods={periods} label="Members" wideLabels />);
    const earlier = screen.getByRole("button", { name: "Earlier periods" }) as HTMLButtonElement;
    const later = screen.getByRole("button", { name: "Later periods" }) as HTMLButtonElement;
    expect(position()).toBe(400);
    expect(later.disabled).toBe(true);
    expect(earlier.disabled).toBe(false);
    fireEvent.click(earlier);
    expect(position()).toBe(304);
    expect(later.disabled).toBe(false);
    const viewport = screen.getByRole("group", { name: "Members" });
    act(() => { viewport.scrollLeft = 0; fireEvent.scroll(viewport); });
    expect(earlier.disabled).toBe(true);
    expect(later.disabled).toBe(false);
    fireEvent.click(later);
    expect(position()).toBe(96);
  });

  it("starts Monthly at the left and resets for changed years while preserving default yearly positioning", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(44);
    mockScrollPosition();
    const { rerender } = render(<ScrollableBarChart periods={periods} label="Months" initialScroll="start" showPartialCoverage={false} />);
    const viewport = screen.getByRole("group", { name: "Months" });
    const earlier = screen.getByRole("button", { name: "Earlier periods" }) as HTMLButtonElement;
    const later = screen.getByRole("button", { name: "Later periods" }) as HTMLButtonElement;
    expect(viewport.scrollLeft).toBe(0);
    expect(earlier.disabled).toBe(true);
    expect(later.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "2023–2024: 10" })).toBeTruthy();
    expect(screen.getByRole("list").textContent).not.toMatch(/incomplete|\*/i);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2023–2024: 10" }));
    expect(screen.getByRole("status").textContent).toBe("2023–2024: 10");
    fireEvent.click(later);
    expect(viewport.scrollLeft).toBe(58);
    rerender(<ScrollableBarChart periods={periods.map((p) => ({ ...p, id: `next-${p.id}` }))} label="Months" initialScroll="start" showPartialCoverage={false} />);
    expect(viewport.scrollLeft).toBe(0);
    expect(earlier.disabled).toBe(true);
  });

  it("does not cancel page scrolling, trackpad input or browser zoom", () => {
    render(<ScrollableBarChart periods={periods} label="Members" />);
    const chart = screen.getByRole("group", { name: "Members" });
    for (const input of [{ deltaY: 100 }, { deltaY: -100 }, { deltaX: 100 }, { deltaY: 100, ctrlKey: true }, { deltaY: -100, metaKey: true }]) {
      const event = createEvent.wheel(chart, { ...input, cancelable: true });
      fireEvent(chart, event);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});
