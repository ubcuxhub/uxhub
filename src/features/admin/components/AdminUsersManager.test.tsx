// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { UserRecord } from "../types";
import { AdminUsersManager } from "./AdminUsersManager";

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
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  pathname = "/admin/users";
});

function user(overrides: Partial<UserRecord>): UserRecord {
  return {
    birth_date: null, interests: [], profile_photo_path: null, student_verified_at: null, student_verified_by: null,
    id: "dora", auth_user_id: "auth-dora", first_name: "Dora", last_name: "Hu",
    email: "z@example.com", phone: "604-555-0100", preferred_pronouns: "She/Her",
    created_at: "2026-07-21T12:00:00Z", updated_at: null, deleted_at: null,
    dietary_restrictions: null, faculty: "Arts", faculty_email: null, major: "English",
    membership_type_id: "innovator", membership_type_name: "Innovator", membership_expires_at: null,
    membership_pre_ordered_type_id: null, newsletter: true, order_date_deprecated: null,
    order_date: null, role_access: "manager", school_institution: null,
    square_customer_id: null, student_number: 12345, student_status: "undergraduate", user_type: "ubcStudent", year: "2",
    ...overrides,
  };
}
const users = [
  user({}),
  user({ id: "alfred", first_name: "Alfred", last_name: "Austin", email: "a@example.com", role_access: "basic", membership_type_id: null, membership_type_name: null }),
  user({ id: "iris", first_name: "Iris", last_name: "Chan", email: "m@example.com", role_access: "admin", membership_type_id: "explorer", membership_type_name: "Explorer" }),
  user({ id: "retired", first_name: "Bob", last_name: "Zed", email: "b@example.com", role_access: "basic", membership_type_id: "retired-tier", membership_type_name: "Retired Tier" }),
];
const membershipTypes = [{ id: "innovator", name: "Innovator" }, { id: "explorer", name: "Explorer" }];

function renderManager(rows = users, tiers = membershipTypes) {
  return render(<AdminUsersManager users={rows} membershipTypes={tiers} />);
}
function rowNames() {
  return screen.queryAllByRole("link", { name: /^View details for/ }).map((element) => element.getAttribute("aria-label"));
}
function chooseSelect(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
function count() {
  return screen.getByRole("status").textContent;
}

describe("AdminUsersManager", () => {
  it("renders the directory table and searches names or emails without a selector", () => {
    renderManager();
    expect(screen.getAllByRole("columnheader").map((element) => element.textContent)).toEqual(["First Name", "Last Name", "Email", "Tier", "Role Access", "Major"]);
    expect(rowNames()).toEqual(["View details for Alfred Austin", "View details for Iris Chan", "View details for Dora Hu", "View details for Bob Zed"]);
    expect(screen.queryByRole("combobox", { name: "Search by" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " DORA " } });
    expect(rowNames()).toEqual(["View details for Dora Hu"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "M@EXAMPLE" } });
    expect(rowNames()).toEqual(["View details for Iris Chan"]);
  });

  it("links each row to the user's record from the first name", () => {
    renderManager();
    const link = screen.getByRole("link", { name: "View details for Dora Hu" });
    expect(link.getAttribute("href")).toBe("/admin/users/dora");
    expect(link.textContent).toBe("Dora");
    expect(link.hasAttribute("data-replace")).toBe(false);
  });

  it("marks the open record's row and replaces it when another row opens", () => {
    pathname = "/admin/users/iris";
    renderManager();
    const open = screen.getByRole("link", { name: "View details for Iris Chan" });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.closest("tr")?.hasAttribute("data-active")).toBe(true);
    expect(screen.getByRole("link", { name: "View details for Dora Hu" }).hasAttribute("data-replace")).toBe(true);
  });

  it("shows rows from fresh props, as a save re-renders the page", () => {
    const { rerender } = renderManager();
    rerender(<AdminUsersManager users={[user({ first_name: "Dorothy" }), ...users.slice(1)]} membershipTypes={membershipTypes} />);
    expect(screen.getByRole("link", { name: "View details for Dorothy Hu" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View details for Dora Hu" })).toBeNull();
  });

  it("sorts names and creation dates in both directions, with missing dates last", () => {
    renderManager([
      user({ id: "new", first_name: "New", last_name: "Zulu", created_at: "2026-09-01T00:00:00Z" }),
      user({ id: "old", first_name: "Old", last_name: "Beta", created_at: "2025-09-01T00:00:00Z" }),
      user({ id: "unknown", first_name: "Unknown", last_name: "Alpha", created_at: null }),
    ]);
    expect(rowNames()).toEqual(["View details for Unknown Alpha", "View details for Old Beta", "View details for New Zulu"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by name descending" }));
    expect(rowNames()).toEqual(["View details for New Zulu", "View details for Old Beta", "View details for Unknown Alpha"]);
    chooseSelect("Sort by", "Date created");
    expect(rowNames()).toEqual(["View details for New Zulu", "View details for Old Beta", "View details for Unknown Alpha"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by date created ascending" }));
    expect(rowNames()).toEqual(["View details for Old Beta", "View details for New Zulu", "View details for Unknown Alpha"]);
  });

  it("matches a query across both name and email in the same search", () => {
    renderManager([
      user({}),
      user({ id: "email-match", first_name: "Iris", last_name: "Chan", email: "dora@example.com" }),
      user({ id: "neither", first_name: "Bob", last_name: "Zed", email: "bob@example.com" }),
    ]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " DORA " } });
    expect(rowNames()).toEqual(["View details for Iris Chan", "View details for Dora Hu"]);
  });

  it("formats membership tier and filter labels without changing their values", () => {
    renderManager(
      [user({ membership_type_id: "non-ubc", membership_type_name: "nonUbc" })],
      [{ id: "non-ubc", name: "nonUbc" }, { id: "explorer", name: "explorer" }],
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Explorer" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Non UBC" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Non UBC" }));
    expect(rowNames()).toEqual(["View details for Dora Hu"]);
    expect(screen.getByRole("button", { name: "Filters 1" })).toBeTruthy();
  });

  it("intersects tier and role filters, matches alternatives within groups, and clears only filters from the popover", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    for (const name of ["No Membership", "Explorer", "Basic", "Admin"]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }
    expect(rowNames()).toEqual(["View details for Alfred Austin", "View details for Iris Chan"]);
    expect(screen.getByRole("button", { name: "Filters 4" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Dora" } });
    expect(screen.getByText("No users match your search and filters.")).toBeTruthy();
    const popover = screen.getByRole("dialog");
    fireEvent.click(within(popover).getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toEqual(["View details for Dora Hu"]);
  });

  it("offers historical tiers for filtering", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Retired Tier" }));
    expect(rowNames()).toEqual(["View details for Bob Zed"]);
  });
});

describe("Manage users row count", () => {
  it("counts every user until a search or filter applies", () => {
    renderManager();
    expect(count()).toBe("4 users");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("uses the singular noun for one user", () => {
    renderManager([user({})]);
    expect(count()).toBe("1 user");
  });

  it("counts the shown rows out of all while searching, even when every row matches", () => {
    renderManager();
    const region = screen.getByRole("status");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "example.com" } });
    expect(count()).toBe("4 of 4 users");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dora" } });
    expect(count()).toBe("1 of 4 users");
    // One live region that stays mounted, so each change is announced.
    expect(screen.getByRole("status")).toBe(region);
  });

  it("clears the search and every filter, then returns focus to the search", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Basic" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zed" } });
    expect(count()).toBe("1 of 4 users");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(count()).toBe("4 users");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});
