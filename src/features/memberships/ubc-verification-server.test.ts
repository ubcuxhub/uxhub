import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  claim: vi.fn(),
  begin: vi.fn(),
  complete: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { name: "service" } }));
vi.mock("@/lib/supabase-helpers/ubc-verification", () => ({
  claimUbcCodeSend: mocks.claim,
  beginUbcCodeAttempt: mocks.begin,
  completeUbcCodeVerification: mocks.complete,
}));
vi.mock("@/lib/log", () => ({
  log: { info: mocks.info, warn: mocks.warn, error: mocks.error },
  errorFields: () => ({ errorType: "Error" }),
}));

const { sendUbcCode, verifyUbcCode } = await import("./ubc-verification-server");
const { hashUbcCode } = await import("./lib/ubc-code");

const USER = "11111111-1111-4111-8111-111111111111";
const EMAIL = "jane@student.ubc.ca";
const SEND = { audience: "student" as const, email: EMAIL, userId: USER };

/** Every field of every log call, flattened, so a test can look for leaks. */
function loggedText() {
  return JSON.stringify([...mocks.info.mock.calls, ...mocks.warn.mock.calls, ...mocks.error.mock.calls]);
}

/** The code the last send emailed. */
function sentCode() {
  const html = mocks.sendEmail.mock.calls.at(-1)?.[0].html as string;
  return />(\d{6})<\/p>/.exec(html)![1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue({ result: "ok", resendAt: "2026-11-10T00:01:00Z", expiresAt: "2026-11-10T00:10:00Z" });
  mocks.sendEmail.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("sendUbcCode", () => {
  it("emails the code to the saved address and stores only its hash", async () => {
    await expect(sendUbcCode(SEND)).resolves.toEqual({
      status: "sent",
      resendAt: "2026-11-10T00:01:00Z",
      expiresAt: "2026-11-10T00:10:00Z",
    });
    const code = sentCode();
    const claim = mocks.claim.mock.calls[0][1];
    expect(claim).toMatchObject({ userId: USER, email: EMAIL });
    expect(claim.codeHash.equals(hashUbcCode({ code, email: EMAIL, salt: claim.salt, userId: USER }))).toBe(true);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({ to: EMAIL, subject: "Your UX Hub verification code" });
    expect(mocks.info).toHaveBeenCalledWith("ubc_verification.code_sent", { userId: USER, audience: "student" });
    expect(loggedText()).not.toContain(code);
    expect(loggedText()).not.toContain(EMAIL);
  });

  it.each([
    ["cooldown", { status: "cooldown", resendAt: "2026-11-10T00:00:30Z", expiresAt: "2026-11-10T00:09:00Z" }],
    ["daily_cap", { status: "daily_cap" }],
    ["taken", { status: "taken" }],
    ["already_verified", { status: "already_verified" }],
    ["mismatch", { status: "address_changed" }],
  ])("maps a refused %s send without emailing", async (result, expected) => {
    mocks.claim.mockResolvedValue({ result, resendAt: "2026-11-10T00:00:30Z", expiresAt: "2026-11-10T00:09:00Z" });
    await expect(sendUbcCode(SEND)).resolves.toEqual(expected);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("ubc_verification.send_refused", { userId: USER, reason: result });
  });

  it("logs the code for local testing only without Resend outside production", async () => {
    mocks.sendEmail.mockResolvedValue(false);
    vi.stubEnv("NODE_ENV", "development");
    await expect(sendUbcCode(SEND)).resolves.toMatchObject({ status: "sent" });
    const devLine = mocks.info.mock.calls.find(([event]) => event === "ubc_verification.dev_code");
    expect(devLine?.[1]).toMatchObject({ userId: USER, code: expect.stringMatching(/^\d{6}$/) });
    expect(loggedText()).not.toContain(EMAIL);
  });

  it("treats a missing Resend key in production as a failed send, without the code", async () => {
    mocks.sendEmail.mockResolvedValue(false);
    vi.stubEnv("NODE_ENV", "production");
    await expect(sendUbcCode(SEND)).resolves.toEqual({ status: "send_failed" });
    expect(mocks.info.mock.calls.some(([event]) => event === "ubc_verification.dev_code")).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith("ubc_verification.send_failed", { userId: USER, reason: "no_api_key" });
  });

  it("never fails loudly when the email or the claim throws", async () => {
    mocks.sendEmail.mockRejectedValue(new Error(`bounce for ${EMAIL}`));
    await expect(sendUbcCode(SEND)).resolves.toEqual({ status: "send_failed" });
    mocks.claim.mockRejectedValue(new Error("db down"));
    await expect(sendUbcCode(SEND)).resolves.toEqual({ status: "send_failed" });
    expect(loggedText()).not.toContain(EMAIL);
  });
});

describe("verifyUbcCode", () => {
  const salt = Buffer.alloc(16, 7);
  const attempt = (code: string, attemptsLeft = 4) => ({
    result: "ok",
    challengeSentAt: "2026-11-10T00:00:00.123456+00:00",
    codeHash: hashUbcCode({ code, email: EMAIL, salt, userId: USER }),
    codeSalt: salt,
    attemptsLeft,
  });

  it("refuses a malformed code before it costs an attempt", async () => {
    await expect(verifyUbcCode({ email: EMAIL, input: "12a456", userId: USER })).resolves.toEqual({ status: "malformed" });
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("ubc_verification.code_rejected", { userId: USER, reason: "malformed" });
  });

  it("stamps a correct code for the same send it compared against", async () => {
    mocks.begin.mockResolvedValue(attempt("246810"));
    mocks.complete.mockResolvedValue("verified");
    await expect(verifyUbcCode({ email: EMAIL, input: "246 810", userId: USER })).resolves.toEqual({ status: "verified" });
    expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), {
      userId: USER,
      email: EMAIL,
      challengeSentAt: "2026-11-10T00:00:00.123456+00:00",
    });
    expect(mocks.info).toHaveBeenCalledWith("ubc_verification.verified", { userId: USER, via: "code" });
    expect(loggedText()).not.toContain("246810");
  });

  it("treats a second tab's already_verified as verified", async () => {
    mocks.begin.mockResolvedValue(attempt("246810"));
    mocks.complete.mockResolvedValue("already_verified");
    await expect(verifyUbcCode({ email: EMAIL, input: "246810", userId: USER })).resolves.toEqual({ status: "verified" });
  });

  it("says how many tries are left after a wrong code, and locks on the last", async () => {
    mocks.begin.mockResolvedValue(attempt("246810", 2));
    await expect(verifyUbcCode({ email: EMAIL, input: "000000", userId: USER })).resolves.toEqual({ status: "wrong", attemptsLeft: 2 });
    mocks.begin.mockResolvedValue(attempt("246810", 0));
    await expect(verifyUbcCode({ email: EMAIL, input: "000000", userId: USER })).resolves.toEqual({ status: "locked" });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(loggedText()).not.toContain("000000");
  });

  it("reads a stale attempt as a changed address, which sends the member back to the form", async () => {
    mocks.begin.mockResolvedValue({ result: "stale", challengeSentAt: null, codeHash: null, codeSalt: null, attemptsLeft: null });
    await expect(verifyUbcCode({ email: EMAIL, input: "123456", userId: USER })).resolves.toEqual({ status: "address_changed" });
  });

  it.each(["none", "expired", "locked"])("passes %s through from the attempt", async (result) => {
    mocks.begin.mockResolvedValue({ result, challengeSentAt: null, codeHash: null, codeSalt: null, attemptsLeft: null });
    await expect(verifyUbcCode({ email: EMAIL, input: "123456", userId: USER })).resolves.toEqual({ status: result });
  });

  it.each(["stale", "taken"])("passes %s through from completion", async (result) => {
    mocks.begin.mockResolvedValue(attempt("246810"));
    mocks.complete.mockResolvedValue(result);
    await expect(verifyUbcCode({ email: EMAIL, input: "246810", userId: USER })).resolves.toEqual({ status: result });
  });

  it("answers none without a saved address, and error when the database fails", async () => {
    await expect(verifyUbcCode({ email: null, input: "123456", userId: USER })).resolves.toEqual({ status: "none" });
    mocks.begin.mockRejectedValue(new Error("db down"));
    await expect(verifyUbcCode({ email: EMAIL, input: "123456", userId: USER })).resolves.toEqual({ status: "error" });
    expect(mocks.error).toHaveBeenCalledWith("ubc_verification.verify_failed", { userId: USER, errorType: "Error" });
  });
});
