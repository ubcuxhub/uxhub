// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordFrame } from "@/components/shared/RecordDrawer";
import type { UserRecord } from "../types";
import { AdminUserRecord } from "./AdminUserRecord";

const mocks = vi.hoisted(() => ({
  verifyStudent: vi.fn(),
  removePhoto: vi.fn(),
  saveDetails: vi.fn(),
  updateRole: vi.fn(),
  router: { refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  refreshUser: vi.fn(async () => {}),
}));
vi.mock("../user-profile-actions", () => ({ setStudentVerificationAction: mocks.verifyStudent, removeUserProfilePhotoAction: mocks.removePhoto }));
vi.mock("../actions", () => ({ saveManagerUserDetailsAction: mocks.saveDetails, updateUserRoleAction: mocks.updateRole }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `http://localhost/${path}` } }) }) } }) }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ refreshUser: mocks.refreshUser, membershipTermEndsAt: null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/admin/users/dora" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
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
afterEach(cleanup);

let savedUsers: Map<string, UserRecord>;

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    birth_date: null, interests: [], profile_photo_path: null, student_verified_at: null, student_verified_by: null,
    ubc_email: null, ubc_verified_at: null, ubc_verified_via: null, ubc_verified_by: null,
    id: "dora", auth_user_id: "auth-dora", first_name: "Dora", last_name: "Hu",
    email: "z@example.com", phone: "604-555-0100", preferred_pronouns: "She/Her",
    created_at: "2026-07-21T12:00:00Z", updated_at: null, deleted_at: null,
    setup_step: "done", diets: [], allergies: [], other_allergies: [], avatar_preset: null,
    dietary_restrictions: null, faculty: "Arts", faculty_email: null, major: "English",
    membership_type_id: "innovator", membership_type_name: "Innovator", membership_expires_at: null,
    membership_pre_ordered_type_id: null, newsletter: true, order_date_deprecated: null,
    order_date: null, role_access: "manager", school_institution: null,
    square_customer_id: null, student_number: 12345, student_status: "undergraduate", user_type: "ubcStudent", user_type_confirmed_at: null, year: "2",
    ...overrides,
  };
}
const MANUAL_BY_IRIS = { ubc_verified_at: "2026-10-14T19:00:00Z", ubc_verified_via: "manual", ubc_verified_by: "iris" } as const;
const iris = user({ id: "iris", first_name: "Iris", last_name: "Chan", email: "m@example.com", role_access: "admin", membership_type_id: "explorer", membership_type_name: "Explorer" });
const membershipTypes = [{ id: "innovator", name: "Innovator" }, { id: "explorer", name: "Explorer" }];
const nonUbcTypes = [...membershipTypes, { id: "non-ubc", name: "nonUbc" }];
const nonUbcUser = user({ user_type: "nonUbc", school_institution: "Emily Carr", membership_type_id: "non-ubc", membership_type_name: "nonUbc" });

beforeEach(() => {
  vi.clearAllMocks();
  savedUsers = new Map([user(), iris].map((item) => [item.id, { ...item }]));
  mocks.saveDetails.mockImplementation(async (id: string, changes: Partial<UserRecord>) => {
    const saved = { ...savedUsers.get(id)!, ...changes };
    if ("student_number" in changes) {
      saved.student_verified_at = null; saved.student_verified_by = null;
      if (saved.ubc_verified_via === "manual") { saved.ubc_verified_at = null; saved.ubc_verified_via = null; saved.ubc_verified_by = null; }
    }
    savedUsers.set(id, saved);
    return saved;
  });
  mocks.updateRole.mockImplementation(async (_id: string, role: string) => role);
  mocks.verifyStudent.mockImplementation(async (id: string, verified: boolean) => {
    const stamp = verified ? "2026-10-14T19:00:00Z" : null;
    const saved: UserRecord = {
      ...savedUsers.get(id)!,
      student_verified_at: stamp, student_verified_by: verified ? "me" : null,
      ubc_verified_at: stamp, ubc_verified_via: verified ? "manual" : null, ubc_verified_by: verified ? "me" : null,
    };
    savedUsers.set(id, saved);
    return saved;
  });
  mocks.removePhoto.mockImplementation(async (id: string) => ({ ...savedUsers.get(id)!, profile_photo_path: null }));
});

type Props = ComponentProps<typeof AdminUserRecord>;

function renderRecord(props: Partial<Props> = {}) {
  const all: Props = {
    record: savedUsers.get("dora")!,
    verifierName: null,
    membershipTypes,
    canManage: true,
    currentUserId: "me",
    transactions: <p>No purchases yet.</p>,
    ...props,
  };
  const view = render(
    <RecordFrame listHref="/admin/users">
      <AdminUserRecord {...all} />
    </RecordFrame>
  );
  return {
    ...view,
    rerenderRecord: (next: Partial<Props>) =>
      view.rerender(
        <RecordFrame listHref="/admin/users">
          <AdminUserRecord {...all} {...next} />
        </RecordFrame>
      ),
  };
}

const textbox = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const checkbox = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const birthday = () => screen.getByLabelText("Birthday", { selector: "input" }) as HTMLInputElement;
function chooseSelect(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}
/** The value a viewing row shows for `label`. */
function shown(label: string) {
  const term = screen.getAllByText(label).find((element) => element.tagName === "DT");
  return term?.nextElementSibling?.textContent;
}
function edit() {
  fireEvent.click(screen.getByRole("button", { name: "Edit user" }));
}
async function saveAndFinish() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit user" })).toBeTruthy());
}

describe("AdminUserRecord: viewing", () => {
  it("shows the user's identity, details and transactions without editing for an admin", () => {
    renderRecord({ canManage: false });
    expect(screen.getByRole("heading", { level: 2, name: "Dora Hu" })).toBeTruthy();
    expect(screen.getByText("She/Her")).toBeTruthy();
    expect(screen.getByText("User since July 21, 2026")).toBeTruthy();
    expect(screen.getByText("Innovator", { selector: "[data-slot=badge]" })).toBeTruthy();
    expect(shown("School")).toBe("University of British Columbia");
    expect(shown("Verification")).toBe("Not verified");
    expect(shown("Newsletter")).toBe("Subscribed");
    expect(shown("Role")).toBe("Manager");
    expect(shown("Student number")).toBe("12345");
    expect(screen.getByRole("button", { name: "Copy auth user ID" })).toBeTruthy();
    expect(screen.getByText("No purchases yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit user" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows No membership, the verifier and the verified mark", () => {
    renderRecord({
      record: user({ membership_type_id: null, membership_type_name: null, student_verified_at: "2026-10-14T19:00:00Z", student_verified_by: "iris", ...MANUAL_BY_IRIS }),
      verifierName: "Iris Chan",
    });
    expect(screen.getByText("No membership", { selector: "[data-slot=badge]" })).toBeTruthy();
    expect(screen.getByText("UBC verified")).toBeTruthy();
    expect(shown("Verification")).toBe("Verified manually · Oct 14, 2026 · by Iris Chan");
  });

  it("shows the UBC address and an unentered code", () => {
    renderRecord({
      record: user({ ubc_email: "dora@student.ubc.ca" }),
      ubcCodeSentAt: "2026-11-10T19:55:00Z",
    });
    expect(shown("UBC email")).toBe("dora@student.ubc.ca");
    expect(shown("Verification")).toBe("Code sent Nov 10, 2026 · not entered");
    expect(screen.queryByText("UBC verified")).toBeNull();
  });

  it("marks a code-verified member without naming a manager", () => {
    renderRecord({
      record: user({ ubc_email: "dora@student.ubc.ca", ubc_verified_at: "2026-10-14T19:00:00Z", ubc_verified_via: "code" }),
    });
    expect(screen.getByText("UBC verified")).toBeTruthy();
    expect(shown("Verification")).toBe("Verified by code · dora@student.ubc.ca · Oct 14, 2026");
  });

  it("names a verifier whose profile is gone as a former manager", () => {
    renderRecord({ record: user({ student_verified_at: "2026-10-14T19:00:00Z", student_verified_by: "gone", ubc_verified_at: "2026-10-14T19:00:00Z", ubc_verified_via: "manual", ubc_verified_by: "gone" }) });
    expect(shown("Verification")).toContain("by a former or unavailable manager");
  });

  it("renders in the drawer, titled by an h2, with no full page to open", async () => {
    render(
      <RecordFrame listHref="/admin/users">
        <AdminUserRecord record={user()} verifierName={null} membershipTypes={membershipTypes} canManage currentUserId="me" transactions={null} />
      </RecordFrame>
    );
    const drawer = screen.getByRole("dialog", { name: "Dora Hu" });
    expect(within(drawer).getByRole("heading", { level: 2, name: "Dora Hu" })).toBeTruthy();
    expect(within(drawer).getByRole("heading", { level: 3, name: "Contact" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Edit user" })).toBeTruthy();
    expect(within(drawer).queryByRole("link", { name: /Open as full page/ })).toBeNull();
  });

  it("adopts a fresh record from the server", () => {
    const { rerenderRecord } = renderRecord();
    rerenderRecord({ record: user({ first_name: "Dorothy" }) });
    expect(screen.getByRole("heading", { level: 2, name: "Dorothy Hu" })).toBeTruthy();
  });
});

describe("AdminUserRecord: editing", () => {
  it("prefills every editable field and saves the complete draft together", async () => {
    savedUsers.set("dora", user({ birth_date: "2000-02-29", interests: ["Design"] }));
    renderRecord();
    edit();
    const values = { "First name": "Dora", "Last name": "Hu", Email: "z@example.com", Phone: "604-555-0100", "Area of study": "English", "Student number": "12345", Faculty: "Arts" };
    for (const [label, value] of Object.entries(values)) expect(textbox(label).value).toBe(value);
    expect(birthday().value).toBe("2000-02-29");
    expect(screen.getByRole("combobox", { name: "Tier" }).textContent).toBe("Innovator");
    expect(screen.getByRole("combobox", { name: "Year" }).textContent).toBe("2");
    expect(screen.getByRole("combobox", { name: "Role" }).textContent).toBe("Manager");
    expect(checkbox("Subscribed to the newsletter").checked).toBe(true);
    expect(checkbox("Verified").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Remove interest Design" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit user" })).toBeNull();

    fireEvent.change(textbox("First name"), { target: { value: "  Dorothy  " } });
    fireEvent.change(textbox("Area of study"), { target: { value: "Design" } });
    fireEvent.click(checkbox("Subscribed to the newsletter"));
    fireEvent.click(checkbox("Verified"));
    fireEvent.change(birthday(), { target: { value: "2001-01-01" } });
    // A tag still in the box is saved with the rest.
    fireEvent.change(textbox("Interests"), { target: { value: "Research" } });
    expect(mocks.saveDetails).not.toHaveBeenCalled();

    await saveAndFinish();
    expect(mocks.saveDetails).toHaveBeenCalledOnce();
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { first_name: "Dorothy", major: "Design", newsletter: false, birth_date: "2001-01-01", interests: ["Design", "Research"] });
    expect(mocks.verifyStudent).toHaveBeenCalledWith("dora", true);
    expect(mocks.updateRole).not.toHaveBeenCalled();
    expect(mocks.router.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 2, name: "Dorothy Hu" })).toBeTruthy();
    expect(shown("Verification")).toBe("Verified manually · Oct 14, 2026 · by you");
    expect(shown("Birthday")).toBe("Jan 1, 2001");
  });

  it("adds a tag on Enter without saving the record", () => {
    renderRecord();
    edit();
    fireEvent.change(textbox("Interests"), { target: { value: "Research" } });
    fireEvent.keyDown(textbox("Interests"), { key: "Enter" });
    expect(screen.getByRole("button", { name: "Remove interest Research" })).toBeTruthy();
    expect(textbox("Interests").value).toBe("");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
  });

  it("clears verification when the student number changes", () => {
    renderRecord({ record: user({ student_verified_at: "2026-10-14T19:00:00Z", student_verified_by: "iris", ...MANUAL_BY_IRIS }) });
    edit();
    expect(checkbox("Verified").checked).toBe(true);
    fireEvent.change(textbox("Student number"), { target: { value: "38475610" } });
    expect(checkbox("Verified").checked).toBe(false);
  });

  it("locks a UBC member's school while editing and says why", async () => {
    renderRecord();
    edit();
    expect(screen.queryByRole("textbox", { name: "School" })).toBeNull();
    expect(shown("School")).toContain("University of British Columbia");
    expect(shown("School")).toContain("Only Non-UBC members can change their school.");
    await saveAndFinish();
    expect(mocks.saveDetails).not.toHaveBeenCalled();
  });

  it("unlocks School as soon as the draft tier is Non-UBC and saves both", async () => {
    renderRecord({ membershipTypes: nonUbcTypes });
    edit();
    chooseSelect("Tier", "Non UBC");
    fireEvent.change(textbox("School"), { target: { value: "SFU" } });
    await saveAndFinish();
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { membership_type_id: "non-ubc", school_institution: "SFU" });
    expect(shown("School")).toBe("SFU");
    expect(screen.getByText("Non UBC", { selector: "[data-slot=badge]" })).toBeTruthy();
  });

  it.each(["Explorer", "None"])("locks School again and drops its draft when switching from Non-UBC to %s", async (tier) => {
    savedUsers.set("dora", nonUbcUser);
    renderRecord({ membershipTypes: nonUbcTypes });
    edit();
    expect(textbox("School").value).toBe("Emily Carr");
    fireEvent.change(textbox("School"), { target: { value: "SFU" } });
    chooseSelect("Tier", tier);
    expect(screen.queryByRole("textbox", { name: "School" })).toBeNull();
    await saveAndFinish();
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { membership_type_id: tier === "None" ? null : "explorer" });
    expect(shown("School")).toBe("University of British Columbia");
  });

  it("offers a retired tier as the current value but not as a choice", () => {
    renderRecord({ record: user({ membership_type_id: "retired", membership_type_name: "Retired Tier" }) });
    edit();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Tier" }), { key: "Enter" });
    expect(screen.getByRole("option", { name: "Retired Tier" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("discards the draft on Cancel", () => {
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Unsaved" } });
    chooseSelect("Role", "Basic");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "First name" })).toBeNull();
    edit();
    expect(textbox("First name").value).toBe("Dora");
    expect(screen.getByRole("combobox", { name: "Role" }).textContent).toBe("Manager");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it("asks before leaving with unsaved changes", () => {
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Close panel (Esc)" }));
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeTruthy();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.back).not.toHaveBeenCalled();
  });

  it("disables the form while saving and shows the saved values after", async () => {
    let finish!: (saved: UserRecord) => void;
    mocks.saveDetails.mockReturnValue(new Promise<UserRecord>((resolve) => { finish = resolve; }));
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "  Dorothy  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mocks.saveDetails).toHaveBeenCalledWith("dora", { first_name: "Dorothy" });
    expect(screen.getByRole("button", { name: "Save changes" }).getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(textbox("First name").disabled).toBe(true);
    await act(async () => { finish(user({ first_name: "Dorothy" })); });
    expect(screen.getByRole("heading", { level: 2, name: "Dorothy Hu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit user" })).toBeTruthy();
  });

  it("keeps the draft after a failed save and retries it", async () => {
    mocks.saveDetails.mockRejectedValueOnce(new Error("Unable to save user information."));
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Dorothy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Unable to save user information."));
    expect(textbox("First name").value).toBe("Dorothy");
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    await saveAndFinish();
    expect(mocks.saveDetails).toHaveBeenCalledTimes(2);
  });

  it("checks the whole draft before saving anything", () => {
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Dorothy" } });
    fireEvent.change(birthday(), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert").textContent).toContain("future");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
  });

  it("saves nothing when nothing changed", async () => {
    renderRecord();
    edit();
    await saveAndFinish();
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    expect(mocks.verifyStudent).not.toHaveBeenCalled();
    expect(mocks.router.refresh).not.toHaveBeenCalled();
  });
});

describe("AdminUserRecord: role changes", () => {
  it("confirms a role change after Save, keeps the draft when cancelled, and saves the role last", async () => {
    renderRecord({ record: savedUsers.get("iris")! });
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Irene" } });
    chooseSelect("Role", "Manager");
    expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    let confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    expect(confirmation.textContent).toContain("Change Iris Chan from Admin to Manager?");
    expect(mocks.saveDetails).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(textbox("First name").value).toBe("Irene");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Change role access?" })).toBeNull());
    expect(mocks.updateRole).toHaveBeenCalledWith("iris", "manager");
    expect(mocks.saveDetails.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateRole.mock.invocationCallOrder[0]);
    expect(mocks.router.refresh).toHaveBeenCalledOnce();
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(shown("Role")).toBe("Manager");
  });

  it("shows a failed role change in the confirmation, after the rest saved", async () => {
    mocks.updateRole.mockRejectedValueOnce(new Error("You can't remove the last manager."));
    renderRecord({ record: savedUsers.get("iris")! });
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Irene" } });
    chooseSelect("Role", "Basic");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const confirmation = screen.getByRole("dialog", { name: "Change role access?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(within(confirmation).getByText(/Some changes were saved\. You can't remove the last manager\./)).toBeTruthy());
    // The confirmation is modal, so the record behind it is hidden from the tree.
    expect(screen.getByRole("heading", { level: 2, name: "Irene Chan", hidden: true })).toBeTruthy();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("combobox", { name: "Role" }).textContent).toBe("Basic");
  });

  it("refreshes the signed-in user after a manager changes their own role", async () => {
    renderRecord({ currentUserId: "dora" });
    edit();
    expect(screen.getByText("This is your account. Your access changes as soon as you save.")).toBeTruthy();
    chooseSelect("Role", "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Change role access?" })).getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledOnce());
    expect(mocks.updateRole).toHaveBeenCalledWith("dora", "admin");
    expect(mocks.refreshUser).toHaveBeenCalledOnce();
    expect(mocks.refreshUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.router.refresh.mock.invocationCallOrder[0]);
  });
});

describe("AdminUserRecord: photo", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:photo");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  const choosePhoto = (type = "image/png") =>
    fireEvent.change(screen.getByLabelText("Profile photo", { selector: "input" }), { target: { files: [new File(["image"], "photo.png", { type })] } });

  it("stages a chosen photo without uploading it and drops it on Cancel", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderRecord();
    edit();
    const input = screen.getByLabelText("Profile photo", { selector: "input" }) as HTMLInputElement;
    const openPicker = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));
    expect(openPicker).toHaveBeenCalledOnce();
    choosePhoto();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("refuses a file that isn't a JPEG or PNG", () => {
    renderRecord();
    edit();
    choosePhoto("image/gif");
    expect(screen.getByText("Choose a JPEG or PNG up to 4 MiB.")).toBeTruthy();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("uploads on save, and removes a photo only on the next save", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: user({ profile_photo_path: "profiles/dora/photo.png" }) }) });
    vi.stubGlobal("fetch", fetchMock);
    renderRecord();
    edit();
    choosePhoto();
    await saveAndFinish();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/dora/photo", expect.objectContaining({ method: "POST" }));
    expect((fetchMock.mock.calls[0][1].body as FormData).get("expectedPath")).toBe("");

    edit();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeTruthy();
    expect(mocks.removePhoto).not.toHaveBeenCalled();
    await saveAndFinish();
    expect(mocks.removePhoto).toHaveBeenCalledWith("dora", "profiles/dora/photo.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("keeps the photo and the rest of the draft after a partial save, and retries only what's left", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unable to upload photo." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user: user({ first_name: "Dorothy", profile_photo_path: "profiles/dora/photo.png" }) }) });
    vi.stubGlobal("fetch", fetchMock);
    renderRecord();
    edit();
    fireEvent.change(textbox("First name"), { target: { value: "Dorothy" } });
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Some changes were saved. Unable to upload photo."));
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeTruthy();
    expect(textbox("First name").value).toBe("Dorothy");
    await saveAndFinish();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.saveDetails).toHaveBeenCalledOnce();
  });
});
