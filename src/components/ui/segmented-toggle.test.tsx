// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedToggle, SegmentedToggleItem } from "./segmented-toggle";

afterEach(cleanup);

function Toggle({
  onValueChange,
  value,
  defaultValue = "upcoming",
}: {
  onValueChange?: (value: string) => void;
  value?: string;
  defaultValue?: string;
}) {
  return (
    <SegmentedToggle
      aria-label="Show events"
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SegmentedToggleItem value="upcoming">Upcoming</SegmentedToggleItem>
      <SegmentedToggleItem value="past">Past</SegmentedToggleItem>
      <SegmentedToggleItem value="drafts" disabled>
        Drafts
      </SegmentedToggleItem>
    </SegmentedToggle>
  );
}

describe("SegmentedToggle", () => {
  it("is a named radiogroup of radio items with the selected one checked", () => {
    render(<Toggle />);
    expect(screen.getByRole("radiogroup", { name: "Show events" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Upcoming" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Past" }).getAttribute("aria-checked")).toBe("false");
  });

  it("selects another option and reports it", () => {
    const onValueChange = vi.fn();
    render(<Toggle onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Past" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("past");
    expect(screen.getByRole("radio", { name: "Past" }).getAttribute("aria-checked")).toBe("true");
  });

  it("never emits an empty value: re-clicking the selected option makes no call", () => {
    const onValueChange = vi.fn();
    render(<Toggle onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Upcoming" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Upcoming" }).getAttribute("aria-checked")).toBe("true");
  });

  it("follows a controlled value and leaves it to the parent to change", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Toggle value="upcoming" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Past" }));
    expect(onValueChange).toHaveBeenCalledWith("past");
    expect(screen.getByRole("radio", { name: "Upcoming" }).getAttribute("aria-checked")).toBe("true");
    rerender(<Toggle value="past" onValueChange={onValueChange} />);
    expect(screen.getByRole("radio", { name: "Past" }).getAttribute("aria-checked")).toBe("true");
  });

  it("works as a controlled component with state", () => {
    function Wrapper() {
      const [value, setValue] = useState("upcoming");
      return <Toggle value={value} onValueChange={setValue} />;
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("radio", { name: "Past" }));
    expect(screen.getByRole("radio", { name: "Past" }).getAttribute("aria-checked")).toBe("true");
  });

  it("moves focus with the arrow keys, skipping a disabled option", async () => {
    render(<Toggle />);
    const upcoming = screen.getByRole("radio", { name: "Upcoming" });
    upcoming.focus();
    fireEvent.keyDown(upcoming, { key: "ArrowRight" });
    const past = screen.getByRole("radio", { name: "Past" });
    await waitFor(() => expect(document.activeElement).toBe(past));
    fireEvent.keyDown(past, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(upcoming));
    expect(upcoming.getAttribute("aria-checked")).toBe("true");
  });

  it("doesn't select a disabled option", () => {
    const onValueChange = vi.fn();
    render(<Toggle onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Drafts" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("selects as the arrow keys move focus, like a radio group", async () => {
    const onValueChange = vi.fn();
    render(<Toggle onValueChange={onValueChange} />);
    const upcoming = screen.getByRole("radio", { name: "Upcoming" });
    const past = screen.getByRole("radio", { name: "Past" });
    upcoming.focus();
    fireEvent.keyDown(upcoming, { key: "ArrowRight" });
    await waitFor(() => expect(past.getAttribute("aria-checked")).toBe("true"));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("past");

    fireEvent.keyDown(past, { key: "ArrowLeft" });
    await waitFor(() => expect(upcoming.getAttribute("aria-checked")).toBe("true"));
    expect(onValueChange).toHaveBeenLastCalledWith("upcoming");
  });

  it("doesn't change the selection when focus arrives from outside the group", () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <Toggle onValueChange={onValueChange} />
      </>,
    );
    screen.getByRole("button", { name: "Before" }).focus();
    screen.getByRole("radio", { name: "Past" }).focus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Upcoming" }).getAttribute("aria-checked")).toBe("true");
  });
});
