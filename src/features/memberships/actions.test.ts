import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  confirmedEmail: vi.fn(),
  update: vi.fn(),
  release: vi.fn(),
  sendUbcCode: vi.fn(),
  verifyUbcCode: vi.fn(),
  revalidatePath: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/auth/current-user", () => ({ getConfirmedSignInEmail: mocks.confirmedEmail }));
vi.mock("@/lib/supabase-helpers/admin-server", () => ({ adminUpdateUserInfoById: mocks.update }));
vi.mock("@/lib/supabase-helpers/app-settings", () => ({ fetchMembershipTermEndsAt: async () => null }));
vi.mock("@/lib/supabase-helpers/ubc-verification", () => ({ releaseStaleUbcEmailHolds: mocks.release }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("./ubc-verification-server", () => ({ sendUbcCode: mocks.sendUbcCode, verifyUbcCode: mocks.verifyUbcCode }));
vi.mock("@/lib/log", () => ({
  log: { info: mocks.info, warn: vi.fn(), error: mocks.error },
  errorFields: () => ({ errorType: "Error" }),
}));

const {
  saveMembershipProfileAction,
  sendUbcCodeAction,
  updateEligibilityProfileAction,
  verifyUbcCodeAction,
} = await import("./actions");

const USER = {
  id: "user-1",
  email: "jane@example.com",
  user_type: "ubcStudent",
  membership_type_id: null,
  membership_expires_at: null,
  membership_pre_ordered_type_id: null,
  ubc_email: null,
  ubc_verified_at: null,
  ubc_verified_via: null,
  student_number: 28471936,
} as unknown as UserInfoRow;

const STUDENT_INPUT = {
  audience: "student" as const,
  studentNumber: "28471936",
  faculty: "Faculty of Arts",
  year: "2" as const,
  major: "Psychology",
  ubcEmail: " Jane@Student.UBC.ca ",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(USER);
  mocks.confirmedEmail.mockResolvedValue(null);
  mocks.update.mockImplementation(async (_id: string, update: Partial<UserInfoRow>) => [{ ...USER, ...update }]);
  mocks.sendUbcCode.mockResolvedValue({ status: "sent", resendAt: "r", expiresAt: "e" });
});

describe("saveMembershipProfileAction", () => {
  it("saves the address and sends a code when nothing proves it yet", async () => {
    await expect(saveMembershipProfileAction(STUDENT_INPUT)).resolves.toEqual({
      ok: true,
      verification: "code",
      email: "jane@student.ubc.ca",
      send: { status: "sent", resendAt: "r", expiresAt: "e" },
    });
    expect(mocks.update).toHaveBeenCalledWith("user-1", expect.objectContaining({ ubc_email: "jane@student.ubc.ca" }));
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("ubc_verified_at");
    expect(mocks.sendUbcCode).toHaveBeenCalledWith({ audience: "student", email: "jane@student.ubc.ca", userId: "user-1" });
  });

  it("stamps a confirmed sign-in email that qualifies, with no code", async () => {
    mocks.confirmedEmail.mockResolvedValue("JANE@student.ubc.ca");
    await expect(saveMembershipProfileAction(STUDENT_INPUT)).resolves.toEqual({ ok: true, verification: "verified" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({
      ubc_email: "jane@student.ubc.ca",
      ubc_verified_via: "sign_in_email",
      ubc_verified_at: expect.any(String),
      ubc_verified_by: null,
    });
    expect(mocks.release).toHaveBeenCalledWith({}, { email: "jane@student.ubc.ca", userId: "user-1" });
    expect(mocks.sendUbcCode).not.toHaveBeenCalled();
  });

  it("doesn't stamp an unconfirmed or different sign-in email", async () => {
    mocks.confirmedEmail.mockResolvedValue("other@student.ubc.ca");
    await expect(saveMembershipProfileAction(STUDENT_INPUT)).resolves.toMatchObject({ verification: "code" });
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("ubc_verified_via");
  });

  it("doesn't stamp a sign-in email that is the wrong audience's", async () => {
    mocks.confirmedEmail.mockResolvedValue("prof@student.ubc.ca");
    const result = await saveMembershipProfileAction({ audience: "faculty", faculty: "", ubcEmail: "prof@student.ubc.ca" });
    expect(result).toEqual({ ok: false, error: "Use your UBC faculty or staff email, not a student or alumni one." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets faculty prove an address other than their sign-in email, mirrored into faculty_email", async () => {
    mocks.requireAuth.mockResolvedValue({ ...USER, user_type: "faculty" });
    await expect(
      saveMembershipProfileAction({ audience: "faculty", faculty: "", ubcEmail: "prof@cs.ubc.ca" }),
    ).resolves.toMatchObject({ ok: true, verification: "code", email: "prof@cs.ubc.ca" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ ubc_email: "prof@cs.ubc.ca", faculty_email: "prof@cs.ubc.ca" });
  });

  it("sends nothing when the account is already verified for purchase", async () => {
    mocks.update.mockImplementation(async (_id: string, update: Partial<UserInfoRow>) => [
      { ...USER, ...update, ubc_verified_at: new Date().toISOString(), ubc_verified_via: "manual" },
    ]);
    await expect(saveMembershipProfileAction(STUDENT_INPUT)).resolves.toEqual({ ok: true, verification: "verified" });
    expect(mocks.sendUbcCode).not.toHaveBeenCalled();
  });

  it("explains an address another account verified", async () => {
    mocks.confirmedEmail.mockResolvedValue("jane@student.ubc.ca");
    mocks.update.mockRejectedValue({ code: "23505", message: "duplicate" });
    await expect(saveMembershipProfileAction(STUDENT_INPUT)).resolves.toEqual({
      ok: false,
      error: "This UBC email is already verified on another account. Contact a UX Hub exec.",
    });
  });

  it("rejects a non-UBC address for a student", async () => {
    await expect(saveMembershipProfileAction({ ...STUDENT_INPUT, ubcEmail: "jane@gmail.com" })).resolves.toEqual({
      ok: false,
      error: "Use your UBC student email, ending in @student.ubc.ca.",
    });
  });

  it("clears the address for Non-UBC members and needs no code", async () => {
    await expect(
      saveMembershipProfileAction({ audience: "non-ubc", schoolInstitution: "SFU", studentStatus: "", year: "" }),
    ).resolves.toEqual({ ok: true, verification: "verified" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ ubc_email: null, faculty_email: null });
  });
});

describe("sendUbcCodeAction and verifyUbcCodeAction", () => {
  it("send for the saved address only", async () => {
    await expect(sendUbcCodeAction()).resolves.toEqual({ status: "send_failed" });
    mocks.requireAuth.mockResolvedValue({ ...USER, ubc_email: "jane@student.ubc.ca" });
    await sendUbcCodeAction();
    expect(mocks.sendUbcCode).toHaveBeenCalledWith({ audience: "student", email: "jane@student.ubc.ca", userId: "user-1" });
  });

  it("verify against the saved address and revalidate on success", async () => {
    mocks.requireAuth.mockResolvedValue({ ...USER, ubc_email: "jane@student.ubc.ca" });
    mocks.verifyUbcCode.mockResolvedValue({ status: "verified" });
    await expect(verifyUbcCodeAction("123456")).resolves.toEqual({ status: "verified" });
    expect(mocks.verifyUbcCode).toHaveBeenCalledWith({ email: "jane@student.ubc.ca", input: "123456", userId: "user-1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portal/membership");
  });
});

describe("updateEligibilityProfileAction", () => {
  it("no longer requires faculty to sign in with their UBC address", async () => {
    await updateEligibilityProfileAction({ userType: "faculty" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ user_type: "faculty", ubc_email: null, faculty_email: null });
  });

  it("fills and stamps a qualifying confirmed sign-in email on a type change", async () => {
    mocks.confirmedEmail.mockResolvedValue("prof@ubc.ca");
    await updateEligibilityProfileAction({ userType: "faculty" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({
      ubc_email: "prof@ubc.ca",
      faculty_email: "prof@ubc.ca",
      ubc_verified_via: "sign_in_email",
    });
  });

  it("drops a saved address that doesn't qualify for the new type", async () => {
    mocks.requireAuth.mockResolvedValue({ ...USER, ubc_email: "jane@student.ubc.ca" });
    await updateEligibilityProfileAction({ userType: "faculty" });
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ ubc_email: null });
  });

  it("validates a new address by domain", async () => {
    await expect(
      updateEligibilityProfileAction({ userType: "ubcStudent", studentNumber: "28471936", ubcEmail: "jane@ubc.ca" }),
    ).rejects.toThrow("Use your UBC student email");
  });
});
