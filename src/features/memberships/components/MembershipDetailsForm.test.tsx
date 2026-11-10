// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/portal/membership/join/student",
}));
vi.mock("@/components/shared/FlowDialog", () => ({ useFlowDialog: () => ({ setBusy: vi.fn() }) }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ refreshUser: vi.fn() }) }));
vi.mock("@/features/memberships/actions", () => ({
  saveMembershipProfileAction: vi.fn(),
  sendUbcCodeAction: vi.fn(),
  verifyUbcCodeAction: vi.fn(),
}));
vi.mock("@/hooks/use-navigation-recovery", () => ({ useNavigationRecovery: () => vi.fn() }));

import type { UserInfoRow } from "@/lib/supabase/models";
import {
  isConfirmedAudience,
  MembershipDetailsForm,
  type MembershipDetailsClient,
} from "./MembershipDetailsForm";

const USER = {
  email: "jamie@example.com",
  user_type: "ubcStudent",
  user_type_confirmed_at: null,
  student_number: null,
  faculty: null,
  year: null,
  major: null,
  faculty_email: null,
  school_institution: null,
  student_status: null,
  ubc_email: null,
  ubc_verified_at: null,
  ubc_verified_via: null,
} as unknown as UserInfoRow;

afterEach(cleanup);

describe("MembershipDetailsForm after join skipped the question", () => {
  it("knows which details belong to the answered type", () => {
    const answered = { ...USER, user_type_confirmed_at: "2026-11-10T00:00:00Z" };
    expect(isConfirmedAudience(answered, "student")).toBe(true);
    expect(isConfirmedAudience(answered, "faculty")).toBe(false);
    expect(isConfirmedAudience(USER, "student")).toBe(false);
  });

  it("offers Change back to the question instead of Back", () => {
    render(
      <MembershipDetailsForm
        audience="student"
        returnTo="/portal"
        user={{ ...USER, user_type_confirmed_at: "2026-11-10T00:00:00Z" }}
      />,
    );
    expect(screen.getByText(/Not a UBC student\?/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Change" }).getAttribute("href")).toBe(
      "/portal/membership/join?change=1&returnTo=%2Fportal",
    );
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });

  it("keeps Back to the question when it was asked", () => {
    render(<MembershipDetailsForm audience="student" returnTo="/portal" user={USER} />);
    expect(screen.queryByRole("link", { name: "Change" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe(
      "/portal/membership/join?returnTo=%2Fportal",
    );
  });

  it("goes Back to the question, not past it, after the member chose another type", () => {
    render(
      <MembershipDetailsForm
        audience="faculty"
        returnTo="/portal"
        user={{ ...USER, user_type_confirmed_at: "2026-11-10T00:00:00Z" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe(
      "/portal/membership/join?change=1&returnTo=%2Fportal",
    );
  });
});

describe("MembershipDetailsForm UBC address", () => {
  beforeEach(() => router.replace.mockClear());
  const STUDENT = {
    ...USER,
    user_type_confirmed_at: "2026-11-10T00:00:00Z",
    student_number: 28471936,
    faculty: "Faculty of Arts",
    year: "2",
    major: "Psychology",
  } as unknown as UserInfoRow;
  const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

  function fakeClient(overrides: Partial<MembershipDetailsClient> = {}) {
    return {
      saveProfile: vi.fn(),
      sendCode: vi.fn(),
      verifyCode: vi.fn(),
      ...overrides,
    } as MembershipDetailsClient & Record<string, ReturnType<typeof vi.fn>>;
  }

  it("asks students for their student.ubc.ca address", () => {
    render(<MembershipDetailsForm audience="student" user={STUDENT} />);
    const field = screen.getByLabelText("UBC student email *") as HTMLInputElement;
    expect(field.readOnly).toBe(false);
    expect(field.getAttribute("placeholder")).toBe("name@student.ubc.ca");
    expect(screen.getByText(/Your @student.ubc.ca address/)).toBeTruthy();
  });

  it("locks a qualifying sign-in email as Verified", () => {
    render(
      <MembershipDetailsForm
        audience="faculty"
        user={{ ...STUDENT, user_type: "faculty" } as UserInfoRow}
        ubc={{ signInEmail: "prof@cs.ubc.ca", pending: null }}
      />,
    );
    const field = screen.getByLabelText("UBC faculty email *") as HTMLInputElement;
    expect(field.value).toBe("prof@cs.ubc.ca");
    expect(field.readOnly).toBe(true);
    expect(screen.getByText("Verified", { selector: "[data-slot=badge]" })).toBeTruthy();
  });

  it("sends the address with the details and continues when no code is needed", async () => {
    const client = fakeClient({ saveProfile: vi.fn().mockResolvedValue({ ok: true, verification: "verified" }) });
    render(<MembershipDetailsForm audience="student" user={STUDENT} client={client} returnTo="/portal" />);
    fireEvent.change(screen.getByLabelText("UBC student email *"), { target: { value: "jane@student.ubc.ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/portal/membership?returnTo=%2Fportal"));
    expect(client.saveProfile).toHaveBeenCalledWith(expect.objectContaining({ ubcEmail: "jane@student.ubc.ca" }));
  });

  it("opens the code step in the same dialog step, and Change email goes back with focus", async () => {
    const client = fakeClient({
      saveProfile: vi.fn().mockResolvedValue({
        ok: true,
        verification: "code",
        email: "jane@student.ubc.ca",
        send: { status: "sent", resendAt: later(60), expiresAt: later(600) },
      }),
    });
    render(<MembershipDetailsForm audience="student" user={STUDENT} client={client} />);
    fireEvent.change(screen.getByLabelText("UBC student email *"), { target: { value: "jane@student.ubc.ca" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const code = await screen.findByLabelText("Verification code");
    expect(document.activeElement).toBe(code);
    expect(screen.getByRole("heading", { name: "Verify your UBC email" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    const email = screen.getByLabelText("UBC student email *") as HTMLInputElement;
    expect(email.value).toBe("jane@student.ubc.ca");
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  it("continues once the code is verified", async () => {
    const client = fakeClient({ verifyCode: vi.fn().mockResolvedValue({ status: "verified" }) });
    render(
      <MembershipDetailsForm
        audience="student"
        user={{ ...STUDENT, ubc_email: "jane@student.ubc.ca" } as UserInfoRow}
        client={client}
        ubc={{
          signInEmail: null,
          pending: { email: "jane@student.ubc.ca", sentAt: later(-10), resendAt: later(50), expiresAt: later(590), attemptsLeft: 5 },
        }}
      />,
    );
    // A pending code for the saved address reopens the code state.
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(client.verifyCode).toHaveBeenCalledWith("123456");
  });

  it("ignores a pending code for an address that is no longer saved", () => {
    render(
      <MembershipDetailsForm
        audience="student"
        user={{ ...STUDENT, ubc_email: "new@student.ubc.ca" } as UserInfoRow}
        ubc={{
          signInEmail: null,
          pending: { email: "old@student.ubc.ca", sentAt: later(-10), resendAt: later(50), expiresAt: later(590), attemptsLeft: 5 },
        }}
      />,
    );
    expect(screen.queryByLabelText("Verification code")).toBeNull();
  });
});
