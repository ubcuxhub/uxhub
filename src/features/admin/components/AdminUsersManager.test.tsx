// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRecord } from "../types";
import { AdminUsersManager } from "./AdminUsersManager";

const mocks = vi.hoisted(() => ({
  verifyStudent: vi.fn(), removePhoto: vi.fn(),
  saveDetails: vi.fn(),
  updateUserRoleAction: vi.fn(),
  fetchPurchases: vi.fn(),
  refreshUser: vi.fn(),
  refreshRouter: vi.fn(),
}));
vi.mock("../user-profile-actions", () => ({ setStudentVerificationAction: mocks.verifyStudent, removeUserProfilePhotoAction: mocks.removePhoto }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `http://localhost/${path}` } }) }) } }) }));
vi.mock("../actions", () => ({ saveManagerUserDetailsAction: mocks.saveDetails, updateUserRoleAction: mocks.updateUserRoleAction }));
vi.mock("../user-purchases-action", () => ({ fetchAdminUserPurchasesAction: mocks.fetchPurchases }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ refreshUser: mocks.refreshUser }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refreshRouter }) }));

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
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  savedUsers = new Map(users.map((user) => [user.id, { ...user }]));
  mocks.saveDetails.mockImplementation(async (id, changes) => {
    const saved = { ...savedUsers.get(id)!, ...changes };
    if ("order_date" in changes) saved.order_date_deprecated = changes.order_date;
    if ("student_number" in changes) { saved.student_verified_at = null; saved.student_verified_by = null; }
    savedUsers.set(id, saved);
    return saved;
  });
  mocks.updateUserRoleAction.mockResolvedValue("manager");
  mocks.fetchPurchases.mockResolvedValue([]);
  mocks.verifyStudent.mockImplementation(async (id, verified) => {
    const saved = { ...savedUsers.get(id)!, student_verified_at: verified ? "2026-10-14T12:00:00Z" : null, student_verified_by: verified ? "iris" : null };
    savedUsers.set(id, saved);
    return saved;
  });
  mocks.removePhoto.mockImplementation(async () => user({ profile_photo_path: null }));
  mocks.refreshUser.mockResolvedValue(undefined);
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

let savedUsers: Map<string, UserRecord>;

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
function modal() { return screen.getByRole("dialog", { name: "User Information" }); }
function field(label: string) {
  return within(modal()).getByText(label).parentElement!;
}
function enableEditing() {
  const button = within(modal()).queryByRole("button", { name: "Edit User" });
  if (button) fireEvent.click(button);
}
async function closeModal() {
  fireEvent.click(within(modal()).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "User Information" })).toBeNull());
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

  it("formats membership tier and filter labels without changing their values", () => {
    render(
      <AdminUsersManager
        initialUsers={[user({ membership_type_id: "non-ubc", membership_type_name: "nonUbc" })]}
        membershipTypes={[{ id: "non-ubc", name: "nonUbc" }, { id: "explorer", name: "explorer" }]}
        canManageUsers={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("checkbox", { name: "Explorer" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Non UBC" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Non UBC" }));
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
    expect(within(modal()).queryByText("Unverified")).toBeNull();
    expect((within(modal()).getByRole("checkbox", { name: "Student Verification" }) as HTMLInputElement).disabled).toBe(true);
    expect(within(modal()).queryByText("Under Construction")).toBeNull();
    expect(within(modal()).queryByRole("button", { name: "Verify student" })).toBeNull();
    expect(within(modal()).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(modal()).queryByRole("button", { name: "Edit User" })).toBeNull();
    await closeModal();
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it("prefills every editable field with saved values and saves the complete form from the top checkmark", async () => {
    const current = user({ birth_date: "2000-02-29", interests: ["Design"], order_date_deprecated: "2026-01-01" });
    savedUsers.set(current.id, current);
    render(<AdminUsersManager initialUsers={[current]} membershipTypes={membershipTypes} canManageUsers />);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    const values = { "First Name": "Dora", "Last Name": "Hu", Email: "z@example.com", "Phone Number": "604-555-0100", "Area of Study": "English", "Student Number": "12345", Faculty: "Arts", Year: "2" };
    for (const [label, value] of Object.entries(values)) {
      expect((screen.getByRole("textbox", { name: label }) as HTMLInputElement).value).toBe(value);
    }
    expect((screen.getByLabelText("Birthday", { selector: "input" }) as HTMLInputElement).value).toBe("2000-02-29");
    expect(within(field("Membership Type")).getByText("Innovator")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Role Access" }).textContent).toBe("Manager");
    expect((screen.getByRole("checkbox", { name: "Newsletter Opt-In" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Remove interest Design" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "  Dorothy  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Area of Study" }), { target: { value: "Design" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Newsletter Opt-In" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Student Verification" }));
    fireEvent.change(screen.getByLabelText("Birthday", { selector: "input" }), { target: { value: "2001-01-01" } });
    fireEvent.change(screen.getByLabelText("New interest"), { target: { value: "Research" } });
    expect(within(modal()).queryByRole("button", { name: "Save" })).toBeNull();
    expect(within(modal()).queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledOnce();
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { first_name: "Dorothy", major: "Design", newsletter: false, birth_date: "2001-01-01", interests: ["Design", "Research"] });
    expect(mocks.verifyStudent).toHaveBeenCalledWith("dora", true);
    expect(within(field("First Name")).getByText("Dorothy")).toBeTruthy();
    await closeModal();
    expect(screen.getByRole("button", { name: "View details for Dorothy Hu" })).toBeTruthy();
  });

  it("locks the UBC school during editing and explains why on focus", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    const school = screen.getByRole("textbox", { name: "School" }) as HTMLInputElement;
    expect(school.value).toBe("University of British Columbia");
    expect(school.readOnly).toBe(true);
    expect(school.getAttribute("aria-disabled")).toBe("true");
    fireEvent.focus(school);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("Only Non-UBC members can change their school."));
    fireEvent.blur(school);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).not.toHaveBeenCalled();
  });

  it("unlocks School immediately when the draft membership changes to Non-UBC and saves both", async () => {
    render(<AdminUsersManager initialUsers={[users[0]]} membershipTypes={[...membershipTypes, { id: "non-ubc", name: "nonUbc" }]} canManageUsers />);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    expect((screen.getByRole("textbox", { name: "School" }) as HTMLInputElement).readOnly).toBe(true);
    chooseSelect("Membership Type", "Non UBC");
    expect((screen.getByRole("textbox", { name: "School" }) as HTMLInputElement).readOnly).toBe(false);
    fireEvent.change(screen.getByRole("textbox", { name: "School" }), { target: { value: "SFU" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { membership_type_id: "non-ubc", school_institution: "SFU" });
    expect(within(field("School")).getByText("SFU")).toBeTruthy();
    enableEditing();
    expect((screen.getByRole("textbox", { name: "School" }) as HTMLInputElement).readOnly).toBe(false);
  });

  it.each(["Explorer", "None"])("defaults School to UBC and omits its hidden draft when switching from Non-UBC to %s", async (membership) => {
    const current = user({ user_type: "nonUbc", school_institution: "Emily Carr", membership_type_id: "non-ubc", membership_type_name: "nonUbc" });
    savedUsers.set(current.id, current);
    render(<AdminUsersManager initialUsers={[current]} membershipTypes={[...membershipTypes, { id: "non-ubc", name: "nonUbc" }]} canManageUsers />);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "School" }), { target: { value: "SFU" } });
    chooseSelect("Membership Type", membership);
    expect((screen.getByRole("textbox", { name: "School" }) as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByRole("textbox", { name: "School" }) as HTMLInputElement).value).toBe("University of British Columbia");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { membership_type_id: membership === "None" ? null : "explorer" });
    expect(within(field("School")).getByText("University of British Columbia")).toBeTruthy();
  });

  it("prefills and edits a Non-UBC school, supporting both discard and the top save", async () => {
    const current = user({ user_type: "nonUbc", school_institution: "Emily Carr", membership_type_id: "non-ubc", membership_type_name: "nonUbc" });
    savedUsers.set(current.id, current);
    render(<AdminUsersManager initialUsers={[current]} membershipTypes={[{ id: "non-ubc", name: "nonUbc" }]} canManageUsers />);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    let school = screen.getByRole("textbox", { name: "School" }) as HTMLInputElement;
    expect(school.value).toBe("Emily Carr");
    expect(school.readOnly).toBe(false);
    fireEvent.change(school, { target: { value: "SFU" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Do you want to discard all changes?" })).getByRole("button", { name: "Yes" }));
    enableEditing();
    school = screen.getByRole("textbox", { name: "School" }) as HTMLInputElement;
    expect(school.value).toBe("Emily Carr");
    fireEvent.change(school, { target: { value: "  Simon Fraser University  " } });
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { school_institution: "Simon Fraser University" });
    expect(within(field("School")).getByText("Simon Fraser University")).toBeTruthy();
  });

  it("asks Yes or No before discarding all edits and keeps drafts when No is chosen", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Newsletter Opt-In" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Student Verification" }));
    fireEvent.change(screen.getByLabelText("Birthday", { selector: "input" }), { target: { value: "2000-02-29" } });
    fireEvent.change(screen.getByLabelText("New interest"), { target: { value: "Research" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    chooseSelect("Role Access", "Basic");
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    let confirmation = screen.getByRole("dialog", { name: "Do you want to discard all changes?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "No" }));
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).value).toBe("Unsaved");
    expect(screen.getByRole("button", { name: "Remove interest Research" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    confirmation = screen.getByRole("dialog", { name: "Do you want to discard all changes?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy();
    enableEditing();
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).value).toBe("Dora");
    expect((screen.getByRole("checkbox", { name: "Newsletter Opt-In" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Student Verification" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Birthday", { selector: "input" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: "Remove interest Research" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Role Access" }).textContent).toBe("Manager");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
    expect(mocks.updateUserRoleAction).not.toHaveBeenCalled();
  });

  it("protects drafts on Escape and discards them only after confirmation", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Unsaved" } });
    fireEvent.keyDown(modal(), { key: "Escape" });
    const confirmation = screen.getByRole("dialog", { name: "Do you want to discard all changes?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    expect(within(field("First Name")).getByText("Dora")).toBeTruthy();
    expect(mocks.saveDetails).not.toHaveBeenCalled();
  });

  it("blocks dismissal and editing during saving and updates the modal and table after success", async () => {
    let finish!: (saved: UserRecord) => void;
    mocks.saveDetails.mockReturnValue(new Promise<UserRecord>((resolve) => { finish = resolve; }));
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "  Dorothy  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { first_name: "Dorothy" });
    for (const name of ["Close", "Discard changes", "Save changes"]) {
      expect((within(modal()).getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.keyDown(modal(), { key: "Escape" });
    expect(modal()).toBeTruthy();
    await act(async () => { finish(user({ first_name: "Dorothy" })); });
    expect(within(field("First Name")).getByText("Dorothy")).toBeTruthy();
    await closeModal();
    expect(screen.getByRole("button", { name: "View details for Dorothy Hu" })).toBeTruthy();
  });

  it("requires role confirmation only after the checkmark and preserves drafts when cancelled", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Iris Chan" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Irene" } });
    chooseSelect("Role Access", "Manager");
    expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    let confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.updateUserRoleAction).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).value).toBe("Irene");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull());
    expect(mocks.updateUserRoleAction).toHaveBeenCalledWith("iris", "manager");
    expect(mocks.saveDetails.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUserRoleAction.mock.invocationCallOrder[0]);
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(mocks.refreshRouter).toHaveBeenCalledOnce();
    await closeModal();
    expect(screen.getByRole("button", { name: "View details for Irene Chan" })).toBeTruthy();
  });

  it("updates membership tier in the modal and table on the checkmark", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    chooseSelect("Membership Type", "Explorer");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { membership_type_id: "explorer" });
    expect(within(field("Membership Type")).getByText("Explorer")).toBeTruthy();
    await closeModal();
    expect(within(screen.getByRole("button", { name: "View details for Dora Hu" })).getByText("Explorer")).toBeTruthy();
  });

  it("keeps drafts after a save failure and retries them", async () => {
    mocks.saveDetails.mockRejectedValueOnce(new Error("Unable to save user information."));
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Dorothy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Unable to save"));
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).value).toBe("Dorothy");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).toHaveBeenCalledTimes(2);
  });

  it("validates the entire draft before saving anything", () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Dorothy" } });
    fireEvent.change(screen.getByLabelText("Birthday", { selector: "input" }), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert").textContent).toContain("future");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
  });

  it("saves nothing when an unchanged form is confirmed", async () => {
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
  });
});

describe("user photo drafts", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:photo");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("previews a selected photo without uploading and discards it with every other edit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    const input = screen.getByLabelText("Profile photo", { selector: "input" });
    const openPicker = vi.spyOn(input as HTMLInputElement, "click");
    fireEvent.click(screen.getByRole("button", { name: "Change profile photo" }));
    expect(openPicker).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:photo");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Do you want to discard all changes?" })).getByRole("button", { name: "Yes" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("uploads only on the checkmark and stages photo removal until the next save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: user({ profile_photo_path: "profiles/dora/photo.png" }) }) });
    vi.stubGlobal("fetch", fetchMock);
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByLabelText("Profile photo", { selector: "input" }), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/dora/photo", expect.objectContaining({ method: "POST" }));
    expect((fetchMock.mock.calls[0][1].body as FormData).get("expectedPath")).toBe("");
    enableEditing();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(mocks.removePhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(mocks.removePhoto).toHaveBeenCalledWith("dora", "profiles/dora/photo.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("keeps the photo and remaining draft after a partial save and retries only unfinished changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unable to upload photo." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user: user({ first_name: "Dorothy", profile_photo_path: "profiles/dora/photo.png" }) }) });
    vi.stubGlobal("fetch", fetchMock);
    renderManager(true);
    fireEvent.click(screen.getByRole("button", { name: "View details for Dora Hu" }));
    enableEditing();
    fireEvent.change(screen.getByRole("textbox", { name: "First Name" }), { target: { value: "Dorothy" } });
    fireEvent.change(screen.getByLabelText("Profile photo", { selector: "input" }), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Some changes were saved"));
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:photo");
    expect((screen.getByRole("textbox", { name: "First Name" }) as HTMLInputElement).value).toBe("Dorothy");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit User" })).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.saveDetails).toHaveBeenCalledOnce();
    expect(screen.getByRole("img").getAttribute("src")).toBe("http://localhost/profiles/dora/photo.png");
  });
});
