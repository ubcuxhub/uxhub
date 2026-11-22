// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgendaDayTable } from "./AgendaDayTable";
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
const day = { id: "d", date: "2026-11-20", title: "Opening", items: [{ id: "i", title: "Workshop", starts_at: null, ends_at: null, location: null }] };
it("keeps participant rows noninteractive and exposes staff actions through a native row trigger", async () => {
  const view = render(<AgendaDayTable day={day} />);
  expect(screen.queryByRole("button")).toBeNull();
  const select = vi.fn();
  view.rerender(<AgendaDayTable day={day} actions={() => [{ label: "View Notes", icon: null, onSelect: select }]} />);
  const trigger = screen.getByRole("button", { name: "Actions for Workshop" });
  expect(trigger.tagName).toBe("BUTTON");
  trigger.focus(); fireEvent.click(trigger);
  await screen.findByRole("dialog");
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  fireEvent.click(trigger);
  const popover = await screen.findByRole("dialog");
  fireEvent.click(popover.querySelector("button")!);
  expect(select).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("dismisses on an outside pointer interaction and returns focus to the row trigger", async () => {
  render(<><button>Outside</button><AgendaDayTable day={day} actions={() => [{ label: "View Notes", icon: null }]} /></>);
  const trigger = screen.getByRole("button", { name: "Actions for Workshop" });
  fireEvent.click(trigger);
  await screen.findByRole("dialog");
  // Radix installs the document pointer listener on the next event-loop turn.
  await new Promise(resolve => setTimeout(resolve, 0));
  const outside = screen.getByRole("button", { name: "Outside" });
  fireEvent.pointerDown(outside, { pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(outside, { pointerType: "mouse", button: 0 });
  fireEvent.click(outside);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("allocates expanded staff columns without changing participant or compact time widths", () => {
  const view = render(<AgendaDayTable day={day} />);
  const columns = () => Array.from(view.container.querySelectorAll("col"));
  expect(columns()).toHaveLength(4);
  expect(columns()[0].className).toBe("w-48 @min-[48rem]/agenda:w-56");
  expect(columns()[1].className).toBe("");
  expect(columns()[2].className).toContain("w-40");
  expect(columns()[3].className).toContain("w-24");
  view.rerender(<AgendaDayTable day={day} actions={() => [{ label: "View Notes", icon: null }]} />);
  expect(columns()).toHaveLength(5);
  for (const [index, percentage] of [20, 30, 16, 14].entries()) {
    expect(columns()[index].className).toContain(`@min-[48rem]/agenda:w-[${percentage}%]`);
  }
  expect(columns()[4].className).toContain("@min-[48rem]/agenda:w-[17rem]");
  expect(columns()[0].className).toContain("w-48");
});

it("lays the wide actions cell out as one right-aligned, non-wrapping row", () => {
  const view = render(<AgendaDayTable day={day} actions={() => [{ label: "View Notes", icon: null }, { label: "Check In", icon: null }]} />);
  const cell = view.container.querySelector("[data-agenda-actions]")!;
  expect(cell.querySelectorAll("button")).toHaveLength(2);
  expect(cell.className).toContain("flex-row");
  expect(cell.className).toContain("justify-end");
  expect(cell.className).toContain("whitespace-nowrap");
  expect(cell.className).not.toContain("flex-col");
});
