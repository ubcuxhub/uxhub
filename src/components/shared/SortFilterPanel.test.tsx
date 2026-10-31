// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";

import { SortFilterPanel, SortFilterSection } from "./SortFilterPanel";

afterEach(cleanup);

function Example({
  activeCount = 2,
  onClearAll = () => {},
}: {
  activeCount?: number;
  onClearAll?: () => void;
}) {
  return (
    <SortFilterPanel
      activeCount={activeCount}
      summary="12 users"
      onClearAll={onClearAll}
    >
      <SortFilterSection title="Membership">
        <FilterChipGroup aria-label="Membership">
          <FilterChip>Innovator</FilterChip>
        </FilterChipGroup>
      </SortFilterSection>
    </SortFilterPanel>
  );
}

describe("SortFilterPanel", () => {
  it("puts the active count in the trigger's visible and accessible names", () => {
    const { rerender } = render(<Example />);

    const trigger = screen.getByRole("button", {
      name: "Sort and filter, 2 active",
    });
    expect(trigger.textContent).toBe("Sort and filter · 2");

    rerender(<Example activeCount={0} />);
    expect(
      screen.getByRole("button", { name: "Sort and filter" }).textContent,
    ).toBe("Sort and filter");
  });

  it("calls Clear all without closing the panel", () => {
    const onClearAll = vi.fn();
    render(<Example onClearAll={onClearAll} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sort and filter, 2 active" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Sort and filter" })).toBeTruthy();
  });

  it("keeps the panel open while chips toggle", () => {
    render(<Example />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sort and filter, 2 active" }),
    );

    const chip = screen.getByRole("button", { name: "Innovator" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Sort and filter" })).toBeTruthy();
  });

  it("returns focus to the trigger when Escape closes the panel", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", {
      name: "Sort and filter, 2 active",
    });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
