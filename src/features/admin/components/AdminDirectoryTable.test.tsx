// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDirectoryTable, type AdminDirectoryColumn } from "./AdminDirectoryTable";

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

afterEach(() => {
  cleanup();
  pathname = "/admin/users";
});

interface Person {
  id: string;
  name: string;
  email: string;
}

const PEOPLE: Person[] = [
  { id: "1", name: "Jane Smith", email: "jane@example.com" },
  { id: "2", name: "Alex Chen", email: "alex@example.com" },
];

const columns: AdminDirectoryColumn<Person>[] = [
  { id: "email", header: "Email", render: (person) => person.email },
  { id: "name", header: "Name", render: (person) => person.name, rowLink: true },
];

function LinkTable({ rows = PEOPLE }: { rows?: Person[] }) {
  return (
    <AdminDirectoryTable
      columns={columns}
      rows={rows}
      getRowKey={(person) => person.id}
      getRowLabel={(person) => `View details for ${person.name}`}
      getRowHref={(person) => `/admin/users/${person.id}`}
      listHref="/admin/users"
      emptyMessage="No users match."
    />
  );
}

describe("AdminDirectoryTable with row links", () => {
  it("links each row's chosen column to its record", () => {
    render(<LinkTable />);
    const jane = screen.getByRole("link", { name: "View details for Jane Smith" });
    expect(jane.getAttribute("href")).toBe("/admin/users/1");
    expect(jane.textContent).toBe("Jane Smith");
    expect(jane.closest("td")?.textContent).toBe("Jane Smith");
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(document.querySelectorAll("[data-record-row]")).toHaveLength(2);
    // No button rows.
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("defaults the link to the first column", () => {
    render(
      <AdminDirectoryTable
        columns={columns.map((column) => ({ ...column, rowLink: false }))}
        rows={PEOPLE}
        getRowKey={(person) => person.id}
        getRowLabel={(person) => person.name}
        getRowHref={(person) => `/admin/users/${person.id}`}
        listHref="/admin/users"
        emptyMessage="No users match."
      />,
    );
    expect(screen.getByRole("link", { name: "Jane Smith" }).textContent).toBe("jane@example.com");
  });

  it("pushes from the list and replaces while a record is open", () => {
    const { rerender } = render(<LinkTable />);
    expect(screen.getByRole("link", { name: "View details for Alex Chen" }).hasAttribute("data-replace")).toBe(false);
    pathname = "/admin/users/1";
    rerender(<LinkTable />);
    expect(screen.getByRole("link", { name: "View details for Alex Chen" }).hasAttribute("data-replace")).toBe(true);
  });

  it("marks the open record's row", () => {
    pathname = "/admin/users/2";
    render(<LinkTable />);
    const alex = screen.getByRole("link", { name: "View details for Alex Chen" });
    expect(alex.getAttribute("aria-current")).toBe("page");
    expect(alex.closest("tr")?.hasAttribute("data-active")).toBe(true);
    const jane = screen.getByRole("link", { name: "View details for Jane Smith" });
    expect(jane.hasAttribute("aria-current")).toBe(false);
    expect(jane.closest("tr")?.hasAttribute("data-active")).toBe(false);
  });

  it("returns focus to the row when its record closes", async () => {
    pathname = "/admin/users/2";
    const { rerender } = render(<LinkTable />);
    // The drawer had focus, and took it with it when it closed.
    (document.activeElement as HTMLElement | null)?.blur();
    pathname = "/admin/users";
    rerender(<LinkTable />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "View details for Alex Chen" })),
    );
  });

  it("moves focus from the row that first opened the drawer to the one that was open", async () => {
    pathname = "/admin/users/1";
    const { rerender } = render(<LinkTable />);
    pathname = "/admin/users/2";
    rerender(<LinkTable />);
    // The drawer's own focus return picked the row it opened from.
    screen.getByRole("link", { name: "View details for Jane Smith" }).focus();
    pathname = "/admin/users";
    rerender(<LinkTable />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "View details for Alex Chen" })),
    );
  });

  it("leaves focus alone when the person moved it elsewhere", async () => {
    pathname = "/admin/users/2";
    const { rerender } = render(
      <>
        <input aria-label="Search users" />
        <LinkTable />
      </>,
    );
    const search = screen.getByRole("textbox", { name: "Search users" });
    search.focus();
    pathname = "/admin/users";
    rerender(
      <>
        <input aria-label="Search users" />
        <LinkTable />
      </>,
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(search);
  });

  it("shows the empty message with no rows", () => {
    render(<LinkTable rows={[]} />);
    expect(screen.getByText("No users match.")).toBeTruthy();
  });
});

