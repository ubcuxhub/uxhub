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
    setup_step: "done", diets: [], allergies: [], other_allergies: [], avatar_preset: null,
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
  user({ id: "alfred", first_name: "Alfred", last_name: "Austin", email: "a@example.com", role_access: "basic", membership_type_id: null, membership_type_name: null, major: null }),
  user({ id: "iris", first_name: "Iris", last_name: "Chan", email: "m@example.com", role_access: "admin", membership_type_id: "explorer", membership_type_name: "Explorer" }),
  user({ id: "retired", first_name: "Bob", last_name: "Zed", email: "b@example.com", role_access: "basic", membership_type_id: "retired-tier", membership_type_name: "Retired Tier" }),
];
const membershipTypes = [{ id: "innovator", name: "Innovator" }, { id: "explorer", name: "Explorer" }];

/** 30 users, "Member 01" to "Member 30", so the list has two pages. */
const many = Array.from({ length: 30 }, (_, index) => {
  const n = String(index + 1).padStart(2, "0");
  return user({ id: `m${n}`, first_name: "Member", last_name: n, email: `member${n}@example.com` });
});

function renderManager(rows = users, tiers = membershipTypes) {
  return render(<AdminUsersManager users={rows} membershipTypes={tiers} />);
}
function rowNames() {
  return within(screen.getByRole("table")).queryAllByRole("link").map((element) => element.getAttribute("aria-label"));
}
function count() {
  return document.querySelector("[data-slot=table-row-count] [role=status]")?.textContent;
}
function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), { target: { value } });
}
/** Opens the Sort and filter panel, unless it is open already. */
function openPanel() {
  const open = screen.queryByRole("dialog");
  if (open) return open;
  fireEvent.click(screen.getByRole("button", { name: /^Sort and filter/ }));
  return screen.getByRole("dialog");
}
function chooseSort(option: string) {
  const panel = openPanel();
  fireEvent.keyDown(within(panel).getByRole("combobox", { name: "Sort by" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
function toggleChip(name: string) {
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));
}

describe("AdminUsersManager", () => {
  it("lists users in the library table, sorted by last name, with the columns as before", () => {
    renderManager();
    expect(screen.getByRole("table").closest("[data-slot=table-card]")).not.toBeNull();
    expect(screen.getByRole("table").hasAttribute("data-sticky")).toBe(true);
    expect(screen.getAllByRole("columnheader").map((element) => element.textContent)).toEqual([
      "First name", "Last name", "Email", "Tier", "Role access", "Major",
    ]);
    expect(rowNames()).toEqual(["Alfred Austin", "Iris Chan", "Dora Hu", "Bob Zed"]);
    // No checkbox column: nothing to act on in bulk yet.
    expect(screen.queryByRole("checkbox")).toBeNull();
    // An empty major reads as None.
    const alfred = screen.getByRole("link", { name: "Alfred Austin" }).closest("tr")!;
    expect(within(alfred).getByText("None")).toBeTruthy();
    expect(within(alfred).getByText("No membership")).toBeTruthy();
  });

  it("searches names and emails as you type", () => {
    renderManager();
    search(" DORA ");
    expect(rowNames()).toEqual(["Dora Hu"]);
    search("M@EXAMPLE");
    expect(rowNames()).toEqual(["Iris Chan"]);
  });

  it("matches a query across both name and email in the same search", () => {
    renderManager([
      user({}),
      user({ id: "email-match", first_name: "Iris", last_name: "Chan", email: "dora@example.com" }),
      user({ id: "neither", first_name: "Bob", last_name: "Zed", email: "bob@example.com" }),
    ]);
    search(" DORA ");
    expect(rowNames()).toEqual(["Iris Chan", "Dora Hu"]);
  });

  it("links each row to the user's record from the first name", () => {
    renderManager();
    const link = screen.getByRole("link", { name: "Dora Hu" });
    expect(link.getAttribute("href")).toBe("/admin/users/dora");
    expect(link.getAttribute("data-slot")).toBe("table-row-link");
    expect(link.textContent).toBe("Dora");
    expect(link.hasAttribute("data-replace")).toBe(false);
    expect(document.querySelectorAll("[data-record-row]")).toHaveLength(4);
  });

  it("marks the open record's row and replaces it when another row opens", () => {
    pathname = "/admin/users/iris";
    renderManager();
    const open = screen.getByRole("link", { name: "Iris Chan" });
    expect(open.getAttribute("aria-current")).toBe("page");
    expect(open.closest("tr")?.hasAttribute("data-active")).toBe(true);
    const other = screen.getByRole("link", { name: "Dora Hu" });
    expect(other.hasAttribute("aria-current")).toBe(false);
    expect(other.closest("tr")?.hasAttribute("data-active")).toBe(false);
    expect(other.hasAttribute("data-replace")).toBe(true);
  });

  it("shows rows from fresh props, as a save re-renders the page", () => {
    const { rerender } = renderManager();
    rerender(<AdminUsersManager users={[user({ first_name: "Dorothy" }), ...users.slice(1)]} membershipTypes={membershipTypes} />);
    expect(screen.getByRole("link", { name: "Dorothy Hu" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dora Hu" })).toBeNull();
  });

  it("sorts names and creation dates in both directions, with missing dates last", () => {
    renderManager([
      user({ id: "new", first_name: "New", last_name: "Zulu", created_at: "2026-09-01T00:00:00Z" }),
      user({ id: "old", first_name: "Old", last_name: "Beta", created_at: "2025-09-01T00:00:00Z" }),
      user({ id: "unknown", first_name: "Unknown", last_name: "Alpha", created_at: null }),
    ]);
    expect(rowNames()).toEqual(["Unknown Alpha", "Old Beta", "New Zulu"]);
    chooseSort("Name, Z to A");
    expect(rowNames()).toEqual(["New Zulu", "Old Beta", "Unknown Alpha"]);
    chooseSort("Newest first");
    expect(rowNames()).toEqual(["New Zulu", "Old Beta", "Unknown Alpha"]);
    chooseSort("Oldest first");
    expect(rowNames()).toEqual(["Old Beta", "New Zulu", "Unknown Alpha"]);
    // A sort other than the default counts as one active setting.
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();
  });

  it("formats membership tier labels without changing their values", () => {
    renderManager(
      [user({ membership_type_id: "non-ubc", membership_type_name: "nonUbc" })],
      [{ id: "non-ubc", name: "nonUbc" }, { id: "explorer", name: "explorer" }],
    );
    openPanel();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Explorer" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Non UBC" })).toBeTruthy();
    toggleChip("Non UBC");
    expect(rowNames()).toEqual(["Dora Hu"]);
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();
  });

  it("intersects tier and role filters, matches alternatives within groups, and Clear all keeps the search", () => {
    renderManager();
    openPanel();
    for (const name of ["No membership", "Explorer", "Basic", "Admin"]) toggleChip(name);
    expect(rowNames()).toEqual(["Alfred Austin", "Iris Chan"]);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Basic" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Sort and filter, 4 active" })).toBeTruthy();
    // The panel's footer counts the results in the library's wording.
    expect(within(screen.getByRole("dialog")).getByRole("status").textContent).toBe("2 of 4 users");
    search("Dora");
    expect(screen.getByText("No users match your search and filters.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear all" }));
    expect(rowNames()).toEqual(["Dora Hu"]);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Dora");
  });

  it("offers historical tiers for filtering", () => {
    renderManager();
    openPanel();
    toggleChip("Retired Tier");
    expect(rowNames()).toEqual(["Bob Zed"]);
  });

  it("shows an empty state when there are no users at all", () => {
    renderManager([]);
    expect(screen.getByText("No users yet")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Manage users pagination", () => {
  function goToPage2() {
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  }

  it("shows 25 users a page and pages through the rest", () => {
    renderManager(many);
    expect(rowNames()).toHaveLength(25);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    goToPage2();
    expect(rowNames()).toEqual(["Member 26", "Member 27", "Member 28", "Member 29", "Member 30"]);
    expect(count()).toBe("Showing 26–30 of 30 users");
  });

  it("goes back to page 1 when the search, a filter or the sort changes", () => {
    renderManager(many);
    goToPage2();
    search("member");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(rowNames()[0]).toBe("Member 01");

    goToPage2();
    openPanel();
    toggleChip("Manager");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    goToPage2();
    chooseSort("Name, Z to A");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(rowNames()[0]).toBe("Member 30");
  });

  it("keeps the page when a record opens or closes, and when a save re-renders the rows", () => {
    const { rerender } = renderManager(many);
    goToPage2();
    pathname = "/admin/users/m27";
    rerender(<AdminUsersManager users={many} membershipTypes={membershipTypes} />);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Member 27" }).getAttribute("aria-current")).toBe("page");
    rerender(<AdminUsersManager users={many.map((row) => ({ ...row }))} membershipTypes={membershipTypes} />);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    pathname = "/admin/users";
    rerender(<AdminUsersManager users={many} membershipTypes={membershipTypes} />);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("opens on the page of the record in the URL", () => {
    pathname = "/admin/users/m28";
    renderManager(many);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Member 28" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("Manage users row count", () => {
  it("shows the range and total until a search or filter applies", () => {
    renderManager();
    expect(count()).toBe("Showing 1–4 of 4 users");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    // The count announces the range; the pagination adds no region of its own.
    const footer = screen.getByRole("navigation", { name: "Pagination" });
    expect(footer.querySelectorAll("[role=status], [aria-live]")).toHaveLength(1);
  });

  it("uses the singular noun for one user", () => {
    renderManager([user({})]);
    expect(count()).toBe("Showing 1 of 1 user");
  });

  it("says how many of the full list are shown while searching, even when every row matches", () => {
    renderManager(many);
    const region = document.querySelector("[data-slot=table-row-count] [role=status]");
    search("example.com");
    expect(count()).toBe("Showing 1–25 of 30 users · filtered from 30");
    search("member0");
    expect(count()).toBe("Showing 1–9 of 9 users · filtered from 30");
    search("nobody");
    expect(count()).toBe("0 of 30 users");
    // One live region that stays mounted, so each change is announced.
    expect(document.querySelector("[data-slot=table-row-count] [role=status]")).toBe(region);
  });

  it("Show all clears the search and every filter, then returns focus to the search", () => {
    renderManager();
    openPanel();
    toggleChip("Basic");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    search("zed");
    expect(count()).toBe("Showing 1 of 1 user · filtered from 4");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(count()).toBe("Showing 1–4 of 4 users");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Sort and filter" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});
