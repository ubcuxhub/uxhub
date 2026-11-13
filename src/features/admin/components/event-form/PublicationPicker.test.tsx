// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicationPicker } from "./PublicationPicker";
import { scheduleTimeProblem } from "./EventPublicationControls";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("publication picker", () => {
  it("preserves Pacific date and time independently when typed", () => {
    const onChange = vi.fn();
    render(<PublicationPicker value="2026-10-28T09:30" disabled={false} onChange={onChange} />);
    const time = screen.getByLabelText("Time (PT)");
    fireEvent.change(time, { target: { value: "10:45 AM" } });
    fireEvent.blur(time);
    expect(onChange).toHaveBeenCalledWith("2026-10-28T10:45");
    const date = screen.getByLabelText("Date");
    fireEvent.change(date, { target: { value: "Oct 29, 2026" } });
    fireEvent.blur(date);
    expect(onChange).toHaveBeenCalledWith("2026-10-29T09:30");
  });
  it("associates scheduling errors with both date and time controls", () => {
    render(<PublicationPicker value="2026-10-28T09:30" disabled={false} onChange={vi.fn()} error="Pick a future time." />);
    for (const label of ["Date", "Time (PT)"]) {
      const control = screen.getByLabelText(label);
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
    }
  });
  it("disables both controls during submission", () => {
    render(<PublicationPicker value="" disabled onChange={vi.fn()} />);
    expect((screen.getByLabelText("Date") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Time (PT)") as HTMLInputElement).disabled).toBe(true);
  });
  it("rejects incomplete, ambiguous, nonexistent, elapsed and too-late times", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2024-01-01T00:00:00Z"));
    for (const value of ["", "T10:00", "2024-03-10T02:30", "2024-11-03T01:30", "2023-12-01T12:00"]) expect(scheduleTimeProblem(value, "")).not.toBeNull();
    expect(scheduleTimeProblem("2026-11-02T10:00", "2026-11-02T10:00")).toMatch(/before registration closes/);
    expect(scheduleTimeProblem("2026-11-02T09:00", "2026-11-02T10:00")).toBeNull();
  });
});
