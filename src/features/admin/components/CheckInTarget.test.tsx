// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CheckInTarget, checkInItemContext } from "./CheckInTarget";
afterEach(cleanup);
const item = { id: "overnight", label: "A very long overnight workshop and discussion session", starts_at: "2026-11-16T06:00:00Z", ends_at: "2026-11-16T08:00:00Z" };
it("puts the label and overnight context in one accessible selector without duplicate details", () => {
  render(<CheckInTarget items={[item]} itemId={item.id} onChange={vi.fn()} />);
  const trigger = screen.getByRole("combobox", { name: "Check-in item" });
  expect(trigger.textContent).toContain(item.label);
  expect(checkInItemContext(item)).toBe("Nov 15, 2026 · 11:00 PM – Nov 16, 2026 · 1:00 AM PT");
  expect(trigger.textContent).toContain(checkInItemContext(item));
  expect(screen.getAllByText(item.label)).toHaveLength(1);
  expect(screen.queryByText("Check-in item")).toBeNull();
});
it("keeps useful placeholder and unscheduled context", () => {
  expect(checkInItemContext({ ...item, starts_at: null })).toBe("Time not set");
  render(<CheckInTarget items={[item]} itemId={null} onChange={vi.fn()} />);
  expect(screen.getByRole("combobox", { name: "Check-in item" }).textContent).toContain("Select a check-in item");
});
