import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flags: { studentEvents: true },
  claim: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  send: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  flush: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({ FLAGS: mocks.flags }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase-helpers/application-emails", () => ({
  MAX_APPLICATION_EMAIL_ATTEMPTS: 5,
  claimApplicationEmails: mocks.claim,
  completeApplicationEmail: mocks.complete,
  releaseApplicationEmails: mocks.release,
}));
vi.mock("@/lib/email/client", () => {
  class EmailSendError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = "EmailSendError";
    }
  }
  return { EmailSendError, sendEmail: mocks.send };
});
vi.mock("@/lib/log", () => ({
  log: { info: mocks.info, warn: mocks.warn, error: mocks.error },
  errorFields: () => ({ code: "08006" }),
}));
vi.mock("@sentry/nextjs", () => ({ flush: mocks.flush }));

const { POST } = await import("./route");
const { EmailSendError } = await import("@/lib/email/client");

const NOW = new Date("2026-11-20T20:00:00Z");

function request(secret = "test-secret", timestamp = String(Math.floor(NOW.getTime() / 1000))) {
  return new Request("https://www.ubcuxhub.ca/api/internal/application-emails", {
    method: "POST",
    headers: {
      "x-application-emails-timestamp": timestamp,
      "x-application-emails-signature": createHmac("sha256", secret)
        .update(`application-emails:${timestamp}`)
        .digest("hex"),
    },
  });
}

function claim(n: number, overrides: Record<string, unknown> = {}) {
  return {
    deliveryId: `delivery-${n}`,
    kind: "accepted",
    attempts: 1,
    applicationId: `application-${n}`,
    eventId: "event-1",
    email: `applicant-${n}@example.test`,
    firstName: "Priya",
    eventName: "UXathon",
    eventSlug: "uxathon",
    offerExpiresAt: "2026-11-26T06:45:00Z",
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

/** Runs the route to completion, through the pauses between sends. */
async function run(req: Request) {
  const pending = POST(req);
  await vi.runAllTimersAsync();
  return pending;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APPLICATION_EMAILS_SECRET", "test-secret");
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mocks.flags.studentEvents = true;
  mocks.claim.mockResolvedValue([]);
  mocks.complete.mockResolvedValue(1);
  mocks.release.mockImplementation(async (_db, ids: string[]) => ids.length);
  mocks.send.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("authentication", () => {
  it.each(["", "wrong", "test-secrex"])("rejects the wrong secret %s", async (secret) => {
    expect((await POST(request(secret))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each([
    String(Math.floor(NOW.getTime() / 1000) - 301),
    String(Math.floor(NOW.getTime() / 1000) + 301),
    "0",
    "invalid",
  ])("rejects a stale, future or malformed timestamp %s", async (timestamp) => {
    expect((await POST(request("test-secret", timestamp))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("accepts a timestamp inside the five-minute window", async () => {
    const timestamp = String(Math.floor(NOW.getTime() / 1000) - 299);
    expect((await run(request("test-secret", timestamp))).status).toBe(200);
  });

  it("rejects an unsigned request", async () => {
    expect((await POST(new Request("https://www.ubcuxhub.ca", { method: "POST" }))).status).toBe(401);
  });

  it("fails closed without a configured secret", async () => {
    vi.stubEnv("APPLICATION_EMAILS_SECRET", "");
    expect((await POST(request(""))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});

describe("sending", () => {
  it("does nothing while student events are off", async () => {
    mocks.flags.studentEvents = false;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skipped: "flag" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends each claimed email and records it, logging ids only", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2, { kind: "waitlisted", offerExpiresAt: null })]);

    const response = await run(request());

    expect(await response.json()).toEqual({ claimed: 2, sent: 2, failed: 0, released: 0 });
    expect(mocks.claim).toHaveBeenCalledWith({}, 25);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      to: "applicant-1@example.test",
      subject: "You’re in: UXathon",
    });
    expect(mocks.send.mock.calls[0][0].html).toContain(
      'href="https://www.ubcuxhub.ca/portal/events/uxathon"'
    );
    expect(mocks.complete).toHaveBeenCalledWith({}, "delivery-1", { sent: true });
    expect(mocks.complete).toHaveBeenCalledWith({}, "delivery-2", { sent: true });
    expect(mocks.info).toHaveBeenCalledWith("application.email_sent", {
      deliveryId: "delivery-1",
      applicationId: "application-1",
      kind: "accepted",
    });
    const logged = JSON.stringify([mocks.info.mock.calls, mocks.warn.mock.calls, mocks.error.mock.calls]);
    expect(logged).not.toContain("@example.test");
    expect(logged).not.toContain("Priya");
  });

  it("stops on Resend's rate limit and hands back the rest uncounted", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2), claim(3)]);
    mocks.send
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new EmailSendError("rate_limit_exceeded", "Too many requests"));

    const response = await run(request());

    expect(await response.json()).toEqual({
      claimed: 3,
      sent: 1,
      failed: 0,
      released: 2,
      stopped: "rate_limit_exceeded",
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.release).toHaveBeenCalledWith({}, ["delivery-2", "delivery-3"], "rate_limit_exceeded");
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.warn).toHaveBeenCalledWith("application.email_paused", {
      reason: "rate_limit_exceeded",
      released: 2,
    });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("stops on the daily quota too", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2)]);
    mocks.send.mockRejectedValueOnce(new EmailSendError("daily_quota_exceeded", "Quota"));

    const body = await (await run(request())).json();

    expect(body).toMatchObject({ sent: 0, released: 2, stopped: "daily_quota_exceeded" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.release).toHaveBeenCalledWith({}, ["delivery-1", "delivery-2"], "daily_quota_exceeded");
  });

  it("hands everything back when Resend isn't configured", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2)]);
    mocks.send.mockResolvedValue(false);

    const body = await (await run(request())).json();

    expect(body).toMatchObject({ sent: 0, released: 2, stopped: "NOT_CONFIGURED" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("records a failed email at warn and carries on with the next", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2)]);
    mocks.send.mockRejectedValueOnce(new EmailSendError("validation_error", "Bad address a@b"));
    mocks.complete.mockResolvedValueOnce(2);

    const body = await (await run(request())).json();

    expect(body).toEqual({ claimed: 2, sent: 1, failed: 1, released: 0 });
    expect(mocks.complete).toHaveBeenCalledWith({}, "delivery-1", {
      sent: false,
      errorCode: "validation_error",
    });
    expect(mocks.warn).toHaveBeenCalledWith("application.email_failed", {
      deliveryId: "delivery-1",
      applicationId: "application-1",
      kind: "accepted",
      code: "validation_error",
      attempts: 2,
    });
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it("reports an email that ran out of attempts", async () => {
    mocks.claim.mockResolvedValue([claim(1, { attempts: 5 })]);
    mocks.send.mockRejectedValueOnce(new Error("socket hang up"));
    mocks.complete.mockResolvedValueOnce(5);

    await run(request());

    expect(mocks.error).toHaveBeenCalledWith("application.email_abandoned", {
      deliveryId: "delivery-1",
      applicationId: "application-1",
      kind: "accepted",
      code: "SEND_FAILED",
    });
    expect(mocks.flush).toHaveBeenCalledWith(2000);
  });

  it("pauses between sends", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2)]);
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    await pending;
  });

  it("returns a retryable failure when the claim fails", async () => {
    mocks.claim.mockRejectedValue(new Error("private row data"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.error).toHaveBeenCalledWith("application.email_claim_failed", { code: "08006" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
