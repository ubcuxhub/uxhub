// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterChip, FilterChipGroup } from "./filter-chip";

afterEach(cleanup);

describe("FilterChip", () => {
  it("includes the count in its accessible name", () => {
    render(<FilterChip count={12}>Pending</FilterChip>);
    expect(screen.getByRole("button", { name: "Pending 12" })).toBeTruthy();
  });

  it("omits the count from the name when there is none", () => {
    render(<FilterChip>Pending</FilterChip>);
    expect(screen.getByRole("button", { name: "Pending" })).toBeTruthy();
  });

  it("flips aria-pressed on click and reports the new state", () => {
    const onPressedChange = vi.fn();
    render(<FilterChip onPressedChange={onPressedChange}>Online</FilterChip>);
    const chip = screen.getByRole("button", { name: "Online" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(onPressedChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(onPressedChange).toHaveBeenLastCalledWith(false);
  });

  it("makes aria-pressed follow a controlled `pressed`", () => {
    function Controlled() {
      const [on, setOn] = useState(true);
      return (
        <>
          <FilterChip pressed={on} onPressedChange={setOn}>
            Free
          </FilterChip>
          <button onClick={() => setOn(false)}>Clear</button>
        </>
      );
    }
    render(<Controlled />);
    const chip = screen.getByRole("button", { name: "Free" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  it("doesn't toggle when disabled", () => {
    const onPressedChange = vi.fn();
    render(
      <FilterChip disabled onPressedChange={onPressedChange}>
        Hybrid
      </FilterChip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hybrid" }));
    expect(onPressedChange).not.toHaveBeenCalled();
  });

  it("sits in a named group", () => {
    render(
      <FilterChipGroup aria-label="Filter by status">
        <FilterChip>Pending</FilterChip>
      </FilterChipGroup>,
    );
    expect(screen.getByRole("group", { name: "Filter by status" })).toBeTruthy();
  });
});
