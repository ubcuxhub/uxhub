// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRecord } from "../types";
import { AdminUsersManager } from "./AdminUsersManager";

const mocks = vi.hoisted(() => ({
  updateManagerUserAction: vi.fn(),
  updateUserRoleAction: vi.fn(),
  fetchPurchases: vi.fn(),
  refreshUser: vi.fn(),
  refreshRouter: vi.fn(),
}));
vi.mock("../actions", () => ({ updateManagerUserAction: mocks.updateManagerUserAction, updateUserRoleAction: mocks.updateUserRoleAction }));
vi.mock("../user-purchases-action", () => ({ fetchAdminUserPurchasesAction: mocks.fetchPurchases }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ refreshUser: mocks.refreshUser }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refreshRouter }) }));

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateManagerUserAction.mockResolvedValue(undefined);
  mocks.updateUserRoleAction.mockResolvedValue("manager");
  mocks.fetchPurchases.mockResolvedValue([]);
  mocks.refreshUser.mockResolvedValue(undefined);
});

function user(overrides: Partial<UserRecord>): UserRecord {
  return {
    id: "dora", auth_user_id: "auth-dora", first_name: "Dora", last_name: "Hu",
    email: "z@example.com", phone: "604-555-0100", preferred_pronouns: "She/Her",
    created_at: "2026-07-21T12:00:00Z", updated_at: null, deleted_at: null,
    dietary_restrictions: null, faculty: "Arts", faculty_email: null, major: "English",
    membership_type_id: "innovator", membership_type_name: "Innovator", membership_expires_at: null,
    membership_pre_ordered_type_id: null, newsletter: true, order_date_deprecated: null,
    order_date: null, role_access: "manager", school_institution: "University of British Columbia",
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

function renderManager(canManageUsers = false) {
  return render(<AdminUsersManager initialUsers={users} membershipTypes={membershipTypes} canManageUsers={canManageUsers} />);
}
function rowNames() {
  return screen.queryAllByRole("button", { name: /^View details for/ }).map((element) => element.getAttribute("aria-label"));
}
function chooseSelect(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
function modal() { return screen.getByRole("dialog", { name: "View User Info" }); }
function field(label: string) {
  return within(modal()).getByText(label).parentElement!;
}
function startEdit(label: string) {
  fireEvent.click(within(field(label)).getByRole("button", { name: "Edit" }));
}
async function closeModal() {
  fireEvent.click(within(modal()).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "View User Info" })).toBeNull());
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

  it("sorts names and creation dates in both directions, with missing dates last", () => {
    render(
      <AdminUsersManager
        initialUsers={[
          user({ id: "new", first_name: "New", last_name: "Zulu", created_at: "2026-09-01T00:00:00Z" }),
          user({ id: "old", first_name: "Old", last_name: "Beta", created_at: "2025-09-01T00:00:00Z" }),
          user({ id: "unknown", first_name: "Unknown", last_name: "Alpha", created_at: null }),
        ]}
        membershipTypes={membershipTypes}
        canManageUsers={false}
      />
    );
    expect(rowNames()).toEqual(["View details for Unknown Alpha", "View details for Old Beta", "View details for New Zulu"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by name descending" }));
    expect(rowNames()).toEqual(["View details for New Zulu", "View details for Old Beta", "View details for Unknown Alpha"]);
    chooseSelect("Sort by", "Date created");
    expect(rowNames()).toEqual(["View details for New Zulu", "View details for Old Beta", "View details for Unknown Alpha"]);
    fireEvent.click(screen.getByRole("button", { name: "Sort by date created ascending" }));
    expect(rowNames()).toEqual(["View details for Old Beta", "View details for New Zulu", "View details for Unknown Alpha"]);
  });

  it("matches a query across both name and email in the same search", () => {
    render(
      <AdminUsersManager
        initialUsers={[
          user({}),
          user({ id: "email-match", first_name: "Iris", last_name: "Chan", email: "dora@example.com" }),
          user({ id: "neither", first_name: "Bob", last_name: "Zed", email: "bob@example.com" }),
        ]}
        membershipTypes={membershipTypes}
        canManageUsers={false}
      />
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: " DORA " } });
    expect(rowNames()).toEqual(["View details for Iris Chan", "View details for Dora Hu"]);
  });

  it("title-cases membership filter labels without changing their values", () => {
    render(
      <AdminUsersManager
        initialUsers={[user({ membership_type_id: "non-ubc", membership_type_name: "nonUbc" })]}
        membershipTypes={[{ id: "non-ubc", name: "nonUbc" }, { id: "explorer", name: "explorer" }]}
        canManageUsers={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Explorer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Non Ubc" }));
    expect(rowNames()).toEqual(["View details for Dora Hu"]);
    expect(screen.getByRole("button", { name: "Filters 1" })).toBeTruthy();
  });

  it("intersects tier and role filters, matches alternatives within groups, and clears only filters", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    for (const name of ["No Membership", "Explorer", "Basic", "Admin"]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }
    expect(rowNames()).toEqual(["View details for Alfred Austin", "View details for Iris Chan"]);
    expect(screen.getByRole("button", { name: "Filters 4" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Dora" } });
    expect(screen.getByText("No users match your search and filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toEqual(["View details for Dora Hu"]);
  });

  it("offers historical tiers for filtering", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Retired Tier" }));
    expect(rowNames()).toEqual(["View details for Bob Zed"]);
  });

  it.each(["click", "Enter", " "])("opens user details by %s and returns focus to the row", async (activation) => {
    renderManager();
    const row = screen.getByRole("button", { name: "View details for Dora Hu" });
    row.focus();
    if (activation === "click") fireEvent.click(row);
    else fireEvent.keyDown(row, { key: activation });
    expect(within(modal()).getByText("She/Her")).toBeTruthy();
    expect(within(modal()).getByText("University of British Columbia")).toBeTruthy();
    expect(mocks.fetchPurchases).toHaveBeenCalledWith("dora");
    for (const label of ["Student Verification", "Birthday", "Interests"]) {
      expect(within(within(modal()).getByRole("region", { name: label })).getByText("Under Construction")).toBeTruthy();
    }
    expect(within(modal()).getByText("Profile photo: Under Construction")).toBeTruthy();
    expect(within(modal()).queryByRole("button", { name: "Edit" })).toBeNull();
    await closeModal();
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("discards unsaved edits on Escape and does not save when reopened", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    startEdit("First Name");
    fireEvent.change(within(field("First Name")).getByRole("textbox"), { target: { value: "Unsaved" } });
    fireEvent.keyDown(modal(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    expect(within(field("First Name")).getByText("Dora")).toBeTruthy();
    expect(within(field("First Name")).queryByRole("textbox")).toBeNull();
    expect(mocks.updateManagerUserAction).not.toHaveBeenCalled();
  });

  it("blocks dismissal during saving and updates both modal and table after success", async () => {
    let finish!: () => void;
    mocks.updateManagerUserAction.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    startEdit("First Name");
    fireEvent.change(within(field("First Name")).getByRole("textbox"), { target: { value: "  Dorothy  " } });
    fireEvent.click(within(field("First Name")).getByRole("button", { name: "Save" }));
    expect(mocks.updateManagerUserAction).toHaveBeenCalledWith("dora", "first_name", "Dorothy");
    expect((within(modal()).getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(modal(), { key: "Escape" });
    expect(modal()).toBeTruthy();
    await act(async () => { finish(); });
    expect(within(field("First Name")).getByText("Dorothy")).toBeTruthy();
    await closeModal();
    expect(screen.getByRole("button", { name: "View details for Dorothy Hu" })).toBeTruthy();
  });

  it("requires role confirmation and keeps the user modal open after updating", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Iris Chan" }));
    chooseSelect("Role Access", "Manager");
    const confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    expect(within(confirmation).getByText("Change Iris Chan from admin to manager?")).toBeTruthy();
    expect(mocks.updateUserRoleAction).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(mocks.updateUserRoleAction).toHaveBeenCalledWith("iris", "manager"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull());
    expect(modal()).toBeTruthy();
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(mocks.refreshRouter).toHaveBeenCalledOnce();
    await closeModal();
    const row = screen.getByRole("button", { name: "View details for Iris Chan" });
    expect(within(row).getByText("manager")).toBeTruthy();
  });

  it("keeps the user modal open while role confirmation is pending and supports cancellation", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Iris Chan" }));
    const userDialog = modal();
    chooseSelect("Role Access", "Manager");
    const confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    expect((userDialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull());
    expect(modal()).toBeTruthy();
    expect((within(modal()).getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.updateUserRoleAction).not.toHaveBeenCalled();
  });

  it("updates membership tier in both the modal and table using the existing assignment action", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    startEdit("Membership Type");
    fireEvent.keyDown(within(field("Membership Type")).getByRole("combobox"), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Explorer" }));
    fireEvent.click(within(field("Membership Type")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(within(field("Membership Type")).getByText("Explorer")).toBeTruthy());
    expect(mocks.updateManagerUserAction).toHaveBeenCalledWith("dora", "membership_type_id", "explorer");
    await closeModal();
    expect(within(screen.getByRole("button", { name: "View details for Dora Hu" })).getByText("Explorer")).toBeTruthy();
  });

  it("preserves the selected user's details when an edit removes them from the active filter", async () => {
    renderManager(true);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Dora" } });
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    startEdit("First Name");
    fireEvent.change(within(field("First Name")).getByRole("textbox"), { target: { value: "Dorothy" } });
    fireEvent.click(within(field("First Name")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(within(field("First Name")).getByText("Dorothy")).toBeTruthy());
    await closeModal();
    expect(screen.getByText("No users match your search and filters.")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "User Directory" })));
  });
});
