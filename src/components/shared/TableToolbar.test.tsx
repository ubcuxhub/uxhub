// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatRowCount, TableRowCount, TableToolbar, type TableRowCountValue } from "./TableToolbar";

afterEach(cleanup);

const search = <input aria-label="Search users" />;
const actions = <button type="button">Sort and filter</button>;

function Harness({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        Tick
      </button>
      <TableToolbar
        search={search}
        actions={actions}
        selectedCount={count}
        bulkActions={<button type="button">Export to CSV</button>}
        onClearSelection={() => setCount(0)}
      />
    </>
  );
}

describe("TableToolbar", () => {
  it("shows the actions until rows are selected", () => {
    render(<TableToolbar search={search} actions={actions} />);
    expect(screen.getByRole("button", { name: "Sort and filter" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
  });

  it("swaps in the bulk actions and Clear selection when rows are selected", () => {
    const onClear = vi.fn();
    render(
      <TableToolbar
        search={search}
        actions={actions}
        selectedCount={2}
        bulkActions={<button type="button">Export to CSV</button>}
        onClearSelection={onClear}
      />,
    );
    expect(screen.queryByRole("button", { name: "Sort and filter" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export to CSV" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("announces the count from one live region that is always mounted", () => {
    const { rerender, container } = render(
      <TableToolbar search={search} actions={actions} selectedCount={0} />,
    );
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");

    // The same node gets the first count, so assistive tech sees a change.
    rerender(<TableToolbar search={search} actions={actions} selectedCount={1} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe("1 selected");

    rerender(<TableToolbar search={search} actions={actions} selectedCount={3} />);
    expect(region.textContent).toBe("3 selected");

    // The visible copy is hidden from assistive tech so it is read once.
    expect(container.querySelectorAll("[role=status], [aria-live]")).toHaveLength(1);
    expect(screen.getAllByText("3 selected").filter((el) => el !== region)[0].getAttribute("aria-hidden")).toBe("true");

    rerender(<TableToolbar search={search} actions={actions} selectedCount={0} />);
    expect(region.textContent).toBe("");
  });

  it("moves focus to the first action when Clear selection removes itself", () => {
    render(<Harness initial={2} />);
    const clear = screen.getByRole("button", { name: "Clear selection" });
    clear.focus();
    fireEvent.click(clear);
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Sort and filter" }),
    );
  });

  it("falls back to the search field when there are no actions", () => {
    function NoActions() {
      const [count, setCount] = useState(1);
      return (
        <TableToolbar
          search={search}
          selectedCount={count}
          onClearSelection={() => setCount(0)}
        />
      );
    }
    render(<NoActions />);
    const clear = screen.getByRole("button", { name: "Clear selection" });
    clear.focus();
    fireEvent.click(clear);
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Search users" }),
    );
  });

  it("does not take focus when the selection empties while the user is elsewhere", () => {
    render(<Harness initial={1} />);
    const input = screen.getByRole("textbox", { name: "Search users" });
    input.focus();
    // fireEvent doesn't move focus, so this clears the selection from outside.
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});

describe("TableToolbar row count", () => {
  const noun = { one: "user", other: "users" };
  // The toolbar's own (empty) selection region is a status too.
  const countRegion = () => document.querySelector<HTMLElement>("[data-slot=table-row-count] [role=status]")!;
  const count = (shown: number, total: number, filtered?: boolean): TableRowCountValue => ({ shown, total, noun, filtered });

  it("counts every row by default", () => {
    render(<TableToolbar search={search} actions={actions} count={count(142, 142)} />);
    expect(countRegion().textContent).toBe("142 users");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("uses the singular noun for one row and groups thousands", () => {
    const { rerender } = render(<TableToolbar search={search} count={count(1, 1)} />);
    expect(countRegion().textContent).toBe("1 user");
    rerender(<TableToolbar search={search} count={count(1042, 1042)} />);
    expect(countRegion().textContent).toBe("1,042 users");
  });

  it("counts shown of total while filtered, from one live region that stays mounted", () => {
    const { rerender } = render(<TableToolbar search={search} count={count(142, 142)} />);
    const region = countRegion();
    rerender(<TableToolbar search={search} count={count(38, 142)} />);
    expect(countRegion()).toBe(region);
    expect(region.textContent).toBe("38 of 142 users");
    // A search that matches every row still reads as filtered when told so.
    rerender(<TableToolbar search={search} count={count(142, 142, true)} />);
    expect(region.textContent).toBe("142 of 142 users");
  });

  it("clears the filters from the count line and moves focus to the search", () => {
    function Filtered() {
      const [filtered, setFiltered] = useState(true);
      return (
        <TableToolbar
          search={search}
          actions={actions}
          count={count(filtered ? 38 : 142, 142)}
          onClearFilters={() => setFiltered(false)}
        />
      );
    }
    render(<Filtered />);
    const clear = screen.getByRole("button", { name: "Show all" });
    clear.focus();
    fireEvent.click(clear);
    expect(countRegion().textContent).toBe("142 users");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search users" }));
  });

  it("keeps the selected count as it is while rows are selected", () => {
    render(<TableToolbar search={search} actions={actions} selectedCount={2} count={count(38, 142)} />);
    expect(screen.getAllByText("2 selected").length).toBeGreaterThan(0);
    expect(screen.getByText("38 of 142 users")).toBeTruthy();
  });
});

describe("formatRowCount with a page range", () => {
  const noun = { one: "user", other: "users" };

  it("counts the page's rows out of the whole list", () => {
    expect(formatRowCount({ shown: 142, total: 142, noun, range: { from: 1, to: 25 } })).toBe("Showing 1–25 of 142 users");
    expect(formatRowCount({ shown: 1042, total: 1042, noun, range: { from: 1001, to: 1042 } })).toBe(
      "Showing 1,001–1,042 of 1,042 users",
    );
  });

  it("keeps the full list's size in view while filtered", () => {
    expect(formatRowCount({ shown: 38, total: 142, noun, range: { from: 26, to: 38 } })).toBe(
      "Showing 26–38 of 38 users · filtered from 142",
    );
    // A search that matches every row still says it is filtered when told so.
    expect(formatRowCount({ shown: 4, total: 4, noun, filtered: true, range: { from: 1, to: 4 } })).toBe(
      "Showing 1–4 of 4 users · filtered from 4",
    );
  });

  it("uses the singular for one row", () => {
    expect(formatRowCount({ shown: 1, total: 1, noun, range: { from: 1, to: 1 } })).toBe("Showing 1 of 1 user");
    expect(formatRowCount({ shown: 1, total: 142, noun, range: { from: 1, to: 1 } })).toBe(
      "Showing 1 of 1 user · filtered from 142",
    );
  });

  it("says how many are hidden when a filter leaves nothing", () => {
    expect(formatRowCount({ shown: 0, total: 142, noun, range: { from: 0, to: 0 } })).toBe("0 of 142 users");
    expect(formatRowCount({ shown: 0, total: 0, noun, range: { from: 0, to: 0 } })).toBe("0 users");
  });
});

describe("TableRowCount", () => {
  const noun = { one: "user", other: "users" };

  it("announces a new page or filter from the same live region, and offers Show all while filtered", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <TableRowCount count={{ shown: 142, total: 142, noun, range: { from: 1, to: 25 } }} onClearFilters={onClear} />,
    );
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("Showing 1–25 of 142 users");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();

    rerender(
      <TableRowCount count={{ shown: 38, total: 142, noun, range: { from: 1, to: 25 } }} onClearFilters={onClear} />,
    );
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe("Showing 1–25 of 38 users · filtered from 142");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
