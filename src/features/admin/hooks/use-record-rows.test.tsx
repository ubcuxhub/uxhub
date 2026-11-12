// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Table, TableBody, TableCell, TableRow, TableRowLink } from "@/components/ui/table";
import { useRecordRows } from "./use-record-rows";

let pathname = "/admin/users";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({
    href,
    replace,
    children,
    ...props
  }: { href: string; replace?: boolean; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} data-replace={replace ? "" : undefined} {...props}>{children}</a>
  ),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  pathname = "/admin/users";
});

const PEOPLE = [
  { id: "1", name: "Jane Smith" },
  { id: "2", name: "Alex Chen" },
];

function People({ rows = PEOPLE }: { rows?: typeof PEOPLE }) {
  const records = useRecordRows("/admin/users");
  return (
    <Table>
      <TableBody>
        {rows.map((person) => {
          const href = `/admin/users/${person.id}`;
          return (
            <TableRow key={person.id} {...records.rowProps(href)}>
              <TableCell>
                <TableRowLink {...records.linkProps(href)}>{person.name}</TableRowLink>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

describe("useRecordRows", () => {
  it("pushes from the list and replaces while a record is open", () => {
    const { rerender } = render(<People />);
    expect(screen.getByRole("link", { name: "Alex Chen" }).hasAttribute("data-replace")).toBe(false);
    expect(document.querySelectorAll("[data-record-row]")).toHaveLength(2);
    pathname = "/admin/users/1";
    rerender(<People />);
    expect(screen.getByRole("link", { name: "Alex Chen" }).hasAttribute("data-replace")).toBe(true);
  });

  it("marks the open record's row, ignoring a trailing slash", () => {
    pathname = "/admin/users/2/";
    render(<People />);
    const alex = screen.getByRole("link", { name: "Alex Chen" });
    expect(alex.getAttribute("aria-current")).toBe("page");
    expect(alex.closest("tr")?.hasAttribute("data-active")).toBe(true);
    const jane = screen.getByRole("link", { name: "Jane Smith" });
    expect(jane.hasAttribute("aria-current")).toBe(false);
    expect(jane.closest("tr")?.hasAttribute("data-active")).toBe(false);
  });

  it("returns focus to the row when its record closes", async () => {
    pathname = "/admin/users/2";
    const { rerender } = render(<People />);
    // The drawer had focus, and took it with it when it closed.
    (document.activeElement as HTMLElement | null)?.blur();
    pathname = "/admin/users";
    rerender(<People />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("link", { name: "Alex Chen" })));
  });

  it("moves focus from the row that first opened the drawer to the one that was open", async () => {
    pathname = "/admin/users/1";
    const { rerender } = render(<People />);
    pathname = "/admin/users/2";
    rerender(<People />);
    // The drawer's own focus return picked the row it opened from.
    screen.getByRole("link", { name: "Jane Smith" }).focus();
    pathname = "/admin/users";
    rerender(<People />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("link", { name: "Alex Chen" })));
  });

  it("leaves focus alone when the person moved it elsewhere", async () => {
    pathname = "/admin/users/2";
    const page = (
      <>
        <input aria-label="Search users" />
        <People />
      </>
    );
    const { rerender } = render(page);
    const search = screen.getByRole("textbox", { name: "Search users" });
    search.focus();
    pathname = "/admin/users";
    rerender(page);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(search);
  });

  it("does nothing when the closed record's row is not on screen (another page)", async () => {
    pathname = "/admin/users/2";
    const { rerender } = render(<People />);
    (document.activeElement as HTMLElement | null)?.blur();
    pathname = "/admin/users";
    rerender(<People rows={PEOPLE.slice(0, 1)} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(document.body);
  });
});
