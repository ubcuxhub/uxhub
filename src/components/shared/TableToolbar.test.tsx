// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TableToolbar } from "./TableToolbar";

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
