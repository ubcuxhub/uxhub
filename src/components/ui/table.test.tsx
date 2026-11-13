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
  TableRowLink,
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
  it.each(["default", "separated"] as const)("%s rows preserve native table semantics", (variant) => {
    render(
      <Table variant={variant}>
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

  it.each(["default", "separated"] as const)("%s sticky rows forward clicks once", (variant) => {
    const onClick = vi.fn();
    render(
      <Table stickyFirstColumn variant={variant}>
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

describe("TableRowLink", () => {
  function LinkTable({
    sticky = false,
    current,
    onClick,
  }: {
    sticky?: boolean;
    current?: boolean;
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) {
    return (
      <Table stickyFirstColumn={sticky}>
        <TableBody>
          <TableRow>
            <TableCell>
              <TableRowLink
                href="/admin/users/alex"
                aria-current={current ? "page" : undefined}
                onClick={(event) => {
                  // Stands in for the router, which jsdom doesn't have.
                  event.preventDefault();
                  onClick(event);
                }}
              >
                Alex Chen
              </TableRowLink>
            </TableCell>
            <TableCell>alex@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  it("is a real link inside the cell, stretched over the row", () => {
    render(<LinkTable onClick={() => {}} />);
    const row = screen.getByRole("row");
    expect(row.getAttribute("role")).not.toBe("link");
    const link = within(row).getByRole("link", { name: "Alex Chen" });
    expect(link.getAttribute("href")).toBe("/admin/users/alex");
    expect(link.closest("td")).not.toBeNull();
    expect(link.getAttribute("data-slot")).toBe("table-row-link");
    expect(link.className).toContain("after:inset-0");
    // Not lifted above its own overlay like a plain link in a cell.
    expect(link.hasAttribute("data-table-row-opener")).toBe(true);
  });

  it("marks the open record's row with aria-current", () => {
    const { rerender } = render(<LinkTable current onClick={() => {}} />);
    expect(screen.getByRole("link").getAttribute("aria-current")).toBe("page");
    rerender(<LinkTable onClick={() => {}} />);
    expect(screen.getByRole("link").hasAttribute("aria-current")).toBe(false);
  });

  it("in a sticky table, forwards a click elsewhere on the row once, modifier keys included", () => {
    const onClick = vi.fn();
    render(<LinkTable sticky onClick={(event) => onClick({ meta: event.metaKey, ctrl: event.ctrlKey })} />);
    fireEvent.click(screen.getByText("alex@example.com"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenLastCalledWith({ meta: false, ctrl: false });
    // Cmd-click on the row reaches the link as a Cmd-click, so it opens a new tab.
    fireEvent.click(screen.getByText("alex@example.com"), { metaKey: true });
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenLastCalledWith({ meta: true, ctrl: false });
    // The link itself is not forwarded again.
    fireEvent.click(screen.getByRole("link", { name: "Alex Chen" }));
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

describe("TableCell", () => {
  it("lifts links and controls above the row opener's overlay", () => {
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
    // but not for the row button or row link, whose own `::after` needs the
    // row as its containing block.
    expect(cell.className).toContain("a,button,input,select,textarea");
    expect(cell.className).toContain(":not([data-table-row-opener])]:relative");
    expect(cell.className).toContain(":not([data-table-row-opener])]:z-10");
  });
});
