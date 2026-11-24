// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real client imports server actions; every test passes a fake instead.
vi.mock("./profile/client", () => ({ createServerProfileClient: vi.fn() }));
vi.mock("@/features/setup/actions", () => ({
  finishSetupAction: vi.fn(),
  saveBirthDateAction: vi.fn(),
  saveSetupAboutAction: vi.fn(),
  saveSetupDietaryAction: vi.fn(),
  saveSetupPhotoAction: vi.fn(),
  skipSetupStepAction: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

// Radix measures radios and selects with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { BIRTHDAY_HINT } from "@/features/setup/components/BirthdayField";
import type { SetupState } from "@/features/setup/lib/state";
import { FUTURE_BIRTH_DATE } from "@/lib/birth-date";
import type { UserInfoRow } from "@/lib/supabase/models";

import type { ProfileClient } from "./profile/client";
import { ProfileEditor } from "./ProfileSettings";

const MEMBER: UserInfoRow = {
  id: "user-1",
  auth_user_id: "auth-1",
  email: "maya.chen@student.ubc.ca",
  first_name: "Maya",
  last_name: "Chen",
  preferred_pronouns: "she/her",
  phone: null,
  user_type: "ubcStudent",
  user_type_confirmed_at: "2026-09-02T17:00:00Z",
  faculty: "Faculty of Science",
  faculty_email: null,
  major: "Cognitive Systems",
  year: "3",
  student_number: 31415926,
  school_institution: null,
  student_status: null,
  role_access: "basic",
  membership_type_id: "innovator",
  membership_pre_ordered_type_id: null,
  membership_expires_at: "2099-09-14T12:00:00-07:00",
  created_at: "2025-09-03T12:00:00-07:00",
  updated_at: null,
  deleted_at: null,
  setup_step: "done",
  diets: ["vegetarian"],
  allergies: [],
  other_allergies: [],
  interests: ["ux-research"],
  avatar_preset: null,
  profile_photo_path: "profiles/user-1/a.jpg",
  newsletter: true,
  birth_date: null,
  dietary_restrictions: null,
  order_date_deprecated: null,
  square_customer_id: null,
  student_verified_at: null,
  student_verified_by: null,
};

/** Signed up and skipped setup. */
const NEW_MEMBER: UserInfoRow = {
  ...MEMBER,
  preferred_pronouns: null,
  faculty: null,
  major: null,
  year: null,
  student_number: null,
  membership_type_id: null,
  membership_expires_at: null,
  setup_step: "dietary",
  diets: [],
  interests: [],
  profile_photo_path: null,
};

const SETUP: SetupState = {
  step: "done",
  userType: "ubcStudent",
  userTypeConfirmed: true,
  diets: [],
  allergies: [],
  otherAllergies: [],
  avatarPreset: null,
  profilePhotoPath: null,
  interests: [],
  birthDate: null,
};

type FakeClient = { [K in keyof ProfileClient]: ReturnType<typeof vi.fn> & ProfileClient[K] };

function fakeClient(): FakeClient {
  return {
    saveAbout: vi.fn(async () => {}),
    saveBirthDate: vi.fn(async (birthDate) => ({ ...SETUP, birthDate })),
    saveStudies: vi.fn(async () => {}),
    saveDietary: vi.fn(async (needs) => ({ ...SETUP, ...needs })),
    savePreset: vi.fn(async (preset) => ({ ...SETUP, avatarPreset: preset })),
    saveInterests: vi.fn(async (interests) => ({ ...SETUP, interests })),
    uploadPhoto: vi.fn(async () => ({ ...SETUP, profilePhotoPath: "profiles/user-1/b.jpg" })),
    photoUrl: vi.fn((path: string | null) => (path ? `https://cdn.test/${path}` : null)),
    membershipName: vi.fn(async () => "Innovator"),
  } as never;
}

let client: FakeClient;
let refreshUser: ReturnType<typeof vi.fn>;

function renderEditor(user: UserInfoRow = MEMBER, termEndsAt: string | null = null) {
  return render(
    <ProfileEditor
      user={user}
      membershipTermEndsAt={termEndsAt}
      refreshUser={refreshUser as () => Promise<void>}
      client={client}
      timing={{ delayMs: 5, retryDelaysMs: [] }}
    />,
  );
}

const section = (name: string) => within(screen.getByRole("region", { name }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

beforeEach(() => {
  client = fakeClient();
  refreshUser = vi.fn(async () => {});
});

afterEach(() => {
  cleanup();
});

describe("ProfileEditor states", () => {
  it("shows a filled member: name, membership, photo, locked student number", async () => {
    renderEditor();
    expect(screen.getByText("Maya Chen")).toBeTruthy();
    expect(await screen.findByText("Innovator member")).toBeTruthy();
    expect(client.membershipName).toHaveBeenCalledWith("innovator");
    expect(screen.getByText("Until Sep 14, 2099")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();

    const studentNumber = screen.getByLabelText("Student number") as HTMLInputElement;
    expect(studentNumber.disabled).toBe(true);
    expect(studentNumber.value).toBe("31415926");
    expect(screen.getByText(/Locked while your membership is active/)).toBeTruthy();

    const account = section("Account");
    expect(account.getByText("UBC student")).toBeTruthy();
    expect(account.queryByText(/User type/)).toBeNull();
    expect(section("Interests").getByText("1 selected")).toBeTruthy();
  });

  it("shows a brand-new member's empty states", () => {
    renderEditor(NEW_MEMBER);
    expect(screen.getByRole("button", { name: "Add photo" })).toBeTruthy();
    expect(screen.getAllByText("Not a member").length).toBeGreaterThan(0);
    expect(section("Food and allergies").getByText("Not answered")).toBeTruthy();
    expect(section("Interests").getByText("None selected")).toBeTruthy();
    expect((screen.getByLabelText("Student number") as HTMLInputElement).disabled).toBe(false);
    expect(client.membershipName).not.toHaveBeenCalled();
  });

  it("shows every stored interest, including tags execs added, and keeps those out of the save", async () => {
    renderEditor({ ...MEMBER, interests: ["Figma whiz", "ux-research"] });
    const interests = section("Interests");
    expect(interests.getByText("Added by UX Hub execs")).toBeTruthy();
    expect(interests.getByText("Figma whiz")).toBeTruthy();
    expect(interests.queryByRole("button", { name: "Figma whiz" })).toBeNull();
    expect(interests.getByText("2 selected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "UI design" }));
    // The chips are all the member sends; the server keeps the exec's tag.
    await waitFor(() => expect(client.saveInterests).toHaveBeenCalledWith(["ux-research", "ui-design"]));
    expect(interests.getByText("3 selected")).toBeTruthy();
  });

  it("tags admins and managers", () => {
    renderEditor({ ...MEMBER, role_access: "admin" });
    expect(screen.getByText("Admin")).toBeTruthy();
    cleanup();
    renderEditor({ ...MEMBER, role_access: "manager" });
    expect(screen.getByText("Manager")).toBeTruthy();
  });

  it("calls a pre-order payment processing and locks the student number", () => {
    renderEditor({
      ...NEW_MEMBER,
      student_number: 27182818,
      membership_pre_ordered_type_id: "explorer",
    });
    expect(screen.getAllByText("Payment processing").length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Student number") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/payment is processing/)).toBeTruthy();
  });

  it("names the studies section by account type", () => {
    renderEditor({ ...MEMBER, user_type: "nonUbc", school_institution: "Emily Carr" });
    expect(screen.getByRole("region", { name: "School" })).toBeTruthy();
    expect(screen.getByLabelText("School or institution")).toBeTruthy();
    cleanup();
    renderEditor({ ...MEMBER, user_type: "faculty", faculty_email: "maya.chen@ubc.ca" });
    expect(screen.getByRole("region", { name: "At UBC" })).toBeTruthy();
    expect((screen.getByLabelText("Faculty email") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("ProfileEditor autosave", () => {
  it("saves a section on its own and says so beside it", async () => {
    renderEditor();
    type("Phone", "604 555 0134");
    await waitFor(() => expect(section("About you").getByText(/Saved/)).toBeTruthy());
    expect(client.saveAbout).toHaveBeenCalledWith(
      MEMBER,
      expect.objectContaining({ phone: "604 555 0134", first_name: "Maya" }),
    );
    expect(refreshUser).toHaveBeenCalled();
    expect(section("Studies").queryByText(/Saved/)).toBeNull();
    expect(client.saveStudies).not.toHaveBeenCalled();
  });

  it("shows Couldn't save with Retry next to the failing section, and Retry saves", async () => {
    client.saveAbout.mockRejectedValueOnce(new Error("offline"));
    renderEditor();
    type("Pronouns", "they/them");
    const about = section("About you");
    const retry = await about.findByRole("button", { name: "Retry" });
    expect(about.getByText("Couldn’t save")).toBeTruthy();
    expect(section("Interests").queryByText("Couldn’t save")).toBeNull();

    act(() => retry.click());
    // Retry leaves the page; focus stays in its section.
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "About you" }));
    await waitFor(() => expect(about.getByText(/Saved/)).toBeTruthy());
    expect(client.saveAbout).toHaveBeenCalledTimes(2);
  });

  it("shows a name error only after blur, and holds only that section", async () => {
    renderEditor();
    type("First name", "");
    const firstName = screen.getByLabelText("First name");
    expect(screen.queryByText("Enter your first name.")).toBeNull();

    fireEvent.blur(firstName);
    const error = screen.getByText("Enter your first name.");
    expect(firstName.getAttribute("aria-invalid")).toBe("true");
    expect(firstName.getAttribute("aria-describedby")).toContain(error.closest("[id]")!.id);

    // The rest of the tab keeps saving.
    fireEvent.click(screen.getByRole("button", { name: "UI design" }));
    await waitFor(() => expect(client.saveInterests).toHaveBeenCalledWith(["ux-research", "ui-design"]));
    await waitFor(() => expect(section("Interests").getByText(/Saved/)).toBeTruthy());
    expect(client.saveAbout).not.toHaveBeenCalled();

    // Fixed, it saves.
    type("First name", "Mia");
    expect(screen.queryByText("Enter your first name.")).toBeNull();
    await waitFor(() =>
      expect(client.saveAbout).toHaveBeenCalledWith(MEMBER, expect.objectContaining({ first_name: "Mia" })),
    );
  });

  it("holds a bad student number, and sends a good one through eligibility", async () => {
    renderEditor(NEW_MEMBER);
    const field = screen.getByLabelText("Student number");
    type("Student number", "1234567");
    fireEvent.blur(field);
    expect(screen.getByText("Student numbers are 8 digits.")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(client.saveStudies).not.toHaveBeenCalled();

    type("Student number", "31415926");
    await waitFor(() =>
      expect(client.saveStudies).toHaveBeenCalledWith(
        NEW_MEMBER,
        expect.objectContaining({ student_number: "31415926" }),
        true,
      ),
    );
    await waitFor(() => expect(section("Studies").getByText(/Saved/)).toBeTruthy());
  });

  describe("birthday", () => {
    const birthday = () => screen.getByLabelText(/^Birthday/) as HTMLInputElement;

    it("sits in About you with setup's hint, showing what's stored", () => {
      renderEditor({ ...MEMBER, birth_date: "2004-03-14" });
      const field = birthday();
      expect(field.type).toBe("date");
      expect(field.value).toBe("2004-03-14");
      expect(section("About you").getByText(BIRTHDAY_HINT)).toBeTruthy();
      cleanup();
      renderEditor();
      expect(birthday().value).toBe("");
    });

    it("saves through the birthday action alone, then says Saved", async () => {
      renderEditor();
      type("Birthday", "2004-03-14");
      await waitFor(() => expect(client.saveBirthDate).toHaveBeenCalledWith("2004-03-14"));
      await waitFor(() => expect(section("About you").getByText(/Saved/)).toBeTruthy());
      expect(client.saveAbout).not.toHaveBeenCalled();
      expect(refreshUser).toHaveBeenCalled();
    });

    it("clears a stored birthday", async () => {
      renderEditor({ ...MEMBER, birth_date: "2004-03-14" });
      type("Birthday", "");
      await waitFor(() => expect(client.saveBirthDate).toHaveBeenCalledWith(null));
    });

    it("sends each part of About you only when it changed", async () => {
      renderEditor();
      type("Phone", "604 555 0134");
      type("Birthday", "2004-03-14");
      await waitFor(() => expect(client.saveBirthDate).toHaveBeenCalledTimes(1));
      expect(client.saveAbout).toHaveBeenCalledTimes(1);
      expect(client.saveAbout.mock.calls[0][1]).not.toHaveProperty("birth_date");

      type("Phone", "604 555 0199");
      await waitFor(() => expect(client.saveAbout).toHaveBeenCalledTimes(2));
      expect(client.saveBirthDate).toHaveBeenCalledTimes(1);
    });

    it("retries only the birthday when it fails after the details saved", async () => {
      client.saveBirthDate.mockRejectedValueOnce(new Error("offline"));
      renderEditor();
      type("Phone", "604 555 0134");
      type("Birthday", "2004-03-14");
      const retry = await section("About you").findByRole("button", { name: "Retry" });
      act(() => retry.click());
      await waitFor(() => expect(section("About you").getByText(/Saved/)).toBeTruthy());
      expect(client.saveAbout).toHaveBeenCalledTimes(1);
      expect(client.saveBirthDate).toHaveBeenCalledTimes(2);
    });

    it("holds a future date with setup's message after blur, and saves once fixed", async () => {
      renderEditor();
      type("Birthday", "2999-01-01");
      expect(screen.queryByText(FUTURE_BIRTH_DATE)).toBeNull();
      fireEvent.blur(birthday());
      expect(screen.getByText(FUTURE_BIRTH_DATE)).toBeTruthy();
      expect(birthday().getAttribute("aria-invalid")).toBe("true");
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(client.saveBirthDate).not.toHaveBeenCalled();
      expect(client.saveAbout).not.toHaveBeenCalled();

      type("Birthday", "2004-03-14");
      expect(screen.queryByText(FUTURE_BIRTH_DATE)).toBeNull();
      await waitFor(() => expect(client.saveBirthDate).toHaveBeenCalledWith("2004-03-14"));
    });
  });

  it("records 'no dietary needs' as an answer", async () => {
    renderEditor(NEW_MEMBER);
    fireEvent.click(screen.getByRole("button", { name: "I don't have any dietary needs" }));
    expect(section("Food and allergies").queryByText("Not answered")).toBeNull();
    await waitFor(() =>
      expect(client.saveDietary).toHaveBeenCalledWith({ diets: [], allergies: [], otherAllergies: [] }),
    );
  });

  it("saves what was typed when the tab closes mid-debounce", async () => {
    const { unmount } = render(
      <ProfileEditor
        user={MEMBER}
        membershipTermEndsAt={null}
        refreshUser={refreshUser as () => Promise<void>}
        client={client}
        timing={{ delayMs: 10_000, retryDelaysMs: [] }}
      />,
    );
    type("Phone", "604 555 0199");
    unmount();
    await waitFor(() =>
      expect(client.saveAbout).toHaveBeenCalledWith(MEMBER, expect.objectContaining({ phone: "604 555 0199" })),
    );
  });
});

describe("ProfileEditor onSaved", () => {
  function renderWithOnSaved(onSaved: () => void) {
    return render(
      <ProfileEditor
        user={MEMBER}
        membershipTermEndsAt={null}
        refreshUser={refreshUser as () => Promise<void>}
        onSaved={onSaved}
        client={client}
        timing={{ delayMs: 5, retryDelaysMs: [] }}
      />,
    );
  }

  it("reports a save the server accepted", async () => {
    const onSaved = vi.fn();
    renderWithOnSaved(onSaved);
    type("Phone", "604 555 0134");
    await waitFor(() => expect(section("About you").getByText(/Saved/)).toBeTruthy());
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("doesn't report a failed save", async () => {
    client.saveAbout.mockRejectedValueOnce(new Error("offline"));
    const onSaved = vi.fn();
    renderWithOnSaved(onSaved);
    type("Pronouns", "they/them");
    await section("About you").findByRole("button", { name: "Retry" });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("doesn't report a change put back before it saved", async () => {
    const onSaved = vi.fn();
    renderWithOnSaved(onSaved);
    type("Pronouns", "they/them");
    type("Pronouns", "she/her");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(client.saveAbout).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("ProfileEditor photo", () => {
  it("opens the chooser in place, saves a picked icon, and Done returns focus", async () => {
    renderEditor(NEW_MEMBER);
    const toggle = screen.getByRole("button", { name: "Add photo" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = within(screen.getByRole("region", { name: "Profile photo" }));
    // An in-page panel, not a second dialog.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(panel.getByRole("radio", { name: "Purple flower" }));
    await waitFor(() => expect(client.savePreset).toHaveBeenCalledWith("flower"));
    await waitFor(() => expect(panel.getByText(/Saved/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();

    fireEvent.click(panel.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("region", { name: "Profile photo" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change photo" }));
  });
});
