// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableCheckboxCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowButton,
  TableSkeleton,
} from "./table";

afterEach(cleanup);

// jsdom has no ResizeObserver; Table uses one to measure its scroller.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Table", () => {
  it("is a native table with column headers", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alex</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("scope")).toBe("col");
    expect(screen.getByRole("row", { name: "Alex" })).not.toBeNull();
  });

  it("sets aria-busy while loading", () => {
    render(
      <Table busy>
        <TableBody>
          <TableSkeleton rows={2} columns={3} />
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(6);
  });

  it("renders an empty row spanning the table", () => {
    render(
      <Table>
        <TableBody>
          <TableEmpty colSpan={4}>No users match “x”.</TableEmpty>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("cell", { name: "No users match “x”." }).getAttribute("colspan")).toBe("4");
  });
});

describe("TableNone", () => {
  it("reads as None, not as a dash", () => {
    render(<TableNone />);
    expect(screen.getByText("None").classList.contains("sr-only")).toBe(true);
    expect(screen.getByText("–").getAttribute("aria-hidden")).toBe("true");
  });
});

describe("TableCheckboxCell", () => {
  it("is a labelled checkbox that reports changes", () => {
    const onCheckedChange = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCheckboxCell
              checked={false}
              onCheckedChange={onCheckedChange}
              aria-label="Select Alex Chen"
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alex Chen" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("shows the mixed state on the header checkbox", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableCheckboxCell
              header
              checked="indeterminate"
              onCheckedChange={() => {}}
              aria-label="Select all results"
            />
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const box = screen.getByRole("checkbox", { name: "Select all results" });
    expect((box as HTMLInputElement).indeterminate).toBe(true);
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("columnheader").getAttribute("scope")).toBe("col");
  });
});

describe("TableRowButton", () => {
  it("is a real button inside the cell, not a role on the row", () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <TableRowButton onClick={onClick}>Alex Chen</TableRowButton>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("role")).not.toBe("button");
    const button = within(row).getByRole("button", { name: "Alex Chen" });
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("in a sticky table, a click elsewhere on the row opens it once", () => {
    const onClick = vi.fn();
    render(
      <Table stickyFirstColumn>
        <TableBody>
          <TableRow>
            <TableCell>
              <TableRowButton onClick={onClick}>Alex Chen</TableRowButton>
            </TableCell>
            <TableCell>alex@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    fireEvent.click(screen.getByText("alex@example.com"));
    expect(onClick).toHaveBeenCalledTimes(1);
    // The button itself must not fire twice (once directly, once forwarded).
    fireEvent.click(screen.getByRole("button", { name: "Alex Chen" }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("in a sticky table, the row's onClick runs once per click", () => {
    const rowClick = vi.fn();
    const buttonClick = vi.fn();
    render(
      <Table stickyFirstColumn>
        <TableBody>
          <TableRow onClick={rowClick}>
            <TableCell>
              <TableRowButton onClick={buttonClick}>Alex Chen</TableRowButton>
            </TableCell>
            <TableCell>alex@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    // A plain cell: the click is forwarded to the button, not counted twice.
    fireEvent.click(screen.getByText("alex@example.com"));
    expect(rowClick).toHaveBeenCalledTimes(1);
    expect(buttonClick).toHaveBeenCalledTimes(1);

    // The button itself.
    fireEvent.click(screen.getByRole("button", { name: "Alex Chen" }));
    expect(rowClick).toHaveBeenCalledTimes(2);
    expect(buttonClick).toHaveBeenCalledTimes(2);

    // Still forwards after an earlier click.
    fireEvent.click(screen.getByText("alex@example.com"));
    expect(rowClick).toHaveBeenCalledTimes(3);
    expect(buttonClick).toHaveBeenCalledTimes(3);
  });

  it("does not forward a click that the row's onClick cancelled", () => {
    const buttonClick = vi.fn();
    render(
      <Table stickyFirstColumn>
        <TableBody>
          <TableRow onClick={(event) => event.preventDefault()}>
            <TableCell>
              <TableRowButton onClick={buttonClick}>Alex Chen</TableRowButton>
            </TableCell>
            <TableCell>alex@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    fireEvent.click(screen.getByText("alex@example.com"));
    expect(buttonClick).not.toHaveBeenCalled();
  });
});

describe("TableCell", () => {
  it("lifts links and controls above the row button's overlay", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <TableRowButton>Alex Chen</TableRowButton>
            </TableCell>
            <TableCell>
              <a href="mailto:alex@example.com">alex@example.com</a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole("link").closest("td")!;
    // Tailwind emits `relative z-10` for links and controls inside the cell,
    // but not for the row button, whose own `::after` needs the row as its
    // containing block.
    expect(cell.className).toContain("a,button,input,select,textarea");
    expect(cell.className).toContain(":not([data-slot=table-row-button])]:relative");
    expect(cell.className).toContain(":not([data-slot=table-row-button])]:z-10");
  });
});
