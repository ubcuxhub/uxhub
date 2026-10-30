// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicationPicker } from "./PublicationPicker";

afterEach(cleanup);

describe("publication picker", () => {
  it("changes the calendar date while preserving the Pacific wall-clock time", () => {
    const onChange = vi.fn();
    render(<PublicationPicker value="2026-10-28T09:30" disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Publish Date & Time (Pacific)"));
    fireEvent.click(screen.getByRole("button", { name: /Thursday, October 29/ }));
    expect(onChange).toHaveBeenCalledWith("2026-10-29T09:30");
  });
  it("changes the time without changing the calendar date", () => {
    const onChange = vi.fn();
    render(<PublicationPicker value="2026-10-28T09:30" disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Publish time (Pacific)"), { target: { value: "10:45" } });
    expect(onChange).toHaveBeenCalledWith("2026-10-28T10:45");
    fireEvent.click(screen.getByRole("button", { name: "Clear publish schedule" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
  it("preserves an incomplete input for validation instead of silently clearing it", () => {
    const onChange = vi.fn();
    render(<PublicationPicker value="" disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Publish time (Pacific)"), { target: { value: "10:45" } });
    expect(onChange).toHaveBeenCalledWith("T10:45");
  });
  it("disables date, time and clear while scheduling is unavailable", () => {
    render(<PublicationPicker value="2026-10-28T09:30" disabled onChange={vi.fn()} />);
    expect((screen.getByLabelText("Publish Date & Time (Pacific)") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Publish time (Pacific)") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clear publish schedule" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
