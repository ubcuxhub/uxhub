// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/portal/membership/join/student",
}));
vi.mock("@/components/shared/FlowDialog", () => ({ useFlowDialog: () => ({ setBusy: vi.fn() }) }));
vi.mock("@/lib/auth/user-context", () => ({ useUser: () => ({ refreshUser: vi.fn() }) }));
vi.mock("@/features/memberships/actions", () => ({ saveMembershipProfileAction: vi.fn() }));
vi.mock("@/hooks/use-navigation-recovery", () => ({ useNavigationRecovery: () => vi.fn() }));

import type { UserInfoRow } from "@/lib/supabase/models";
import { isConfirmedAudience, MembershipDetailsForm } from "./MembershipDetailsForm";

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
