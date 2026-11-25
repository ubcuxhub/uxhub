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
vi.mock("@/lib/supabase-helpers/event-reminders", () => ({
  MAX_EVENT_REMINDER_ATTEMPTS: 5,
  claimEventReminders: mocks.claim,
  completeEventReminder: mocks.complete,
  releaseEventReminders: mocks.release,
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
const NOW_SECONDS = String(Math.floor(NOW.getTime() / 1000));

function sign(secret: string, message: string) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function request(
  secret = "test-secret",
  timestamp = NOW_SECONDS,
  signature = sign(secret, `event-reminders:${timestamp}`)
) {
  return new Request("https://www.ubcuxhub.ca/api/internal/event-reminders", {
    method: "POST",
    headers: {
      "x-event-reminders-timestamp": timestamp,
      "x-event-reminders-signature": signature,
    },
  });
}

function claim(n: number, overrides: Record<string, unknown> = {}) {
  return {
    sendId: `send-${n}`,
    kind: "1d",
    attempts: 1,
    ticketId: `ticket-${n}`,
    eventId: "event-1",
    email: `holder-${n}@example.test`,
    firstName: "Priya",
    eventName: "Design Jam",
    eventSlug: "design-jam",
    startsAt: "2026-11-21T18:00:00Z",
    endsAt: "2026-11-21T21:00:00Z",
    location: { type: "in_person", restricted: false, building: "Orchard Commons", room: "1001" },
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

  it("rejects an application emails signature replayed here", async () => {
    const replayed = request("test-secret", NOW_SECONDS, sign("test-secret", `application-emails:${NOW_SECONDS}`));
    expect((await POST(replayed)).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each([
    String(Number(NOW_SECONDS) - 301),
    String(Number(NOW_SECONDS) + 301),
    "0",
    "invalid",
  ])("rejects a stale, future or malformed timestamp %s", async (timestamp) => {
    expect((await POST(request("test-secret", timestamp))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("accepts a timestamp inside the five-minute window", async () => {
    expect((await run(request("test-secret", String(Number(NOW_SECONDS) - 299)))).status).toBe(200);
    expect(mocks.claim).toHaveBeenCalled();
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
    expect(await response.json()).toEqual({ skipped: "flag" });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("sends each claimed reminder with its own copy and records it, logging ids only", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2, { kind: "2h" })]);

    const response = await run(request());

    expect(await response.json()).toEqual({ claimed: 2, sent: 2, failed: 0, released: 0 });
    expect(mocks.claim).toHaveBeenCalledWith({}, 50);
    expect(mocks.send.mock.calls.map(([email]) => [email.to, email.subject])).toEqual([
      ["holder-1@example.test", "See you tomorrow at Design Jam"],
      ["holder-2@example.test", "Design Jam starts soon"],
    ]);
    expect(mocks.send.mock.calls[0][0].html).toContain('href="https://www.ubcuxhub.ca/portal/events/design-jam"');
    expect(mocks.send.mock.calls[0][0].html).toContain("Orchard Commons 1001");
    expect(mocks.complete).toHaveBeenCalledWith({}, "send-1", { sent: true });
    expect(mocks.complete).toHaveBeenCalledWith({}, "send-2", { sent: true });
    expect(mocks.info).toHaveBeenCalledWith("event.reminder_sent", {
      sendId: "send-1",
      ticketId: "ticket-1",
      eventId: "event-1",
      kind: "1d",
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

    const body = await (await run(request())).json();

    expect(body).toEqual({ claimed: 3, sent: 1, failed: 0, released: 2, stopped: "rate_limit_exceeded" });
    expect(mocks.release).toHaveBeenCalledWith({}, ["send-2", "send-3"], "rate_limit_exceeded");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("hands everything back when Resend isn't configured", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2)]);
    mocks.send.mockResolvedValue(false);

    const body = await (await run(request())).json();

    expect(body).toMatchObject({ sent: 0, released: 2, stopped: "NOT_CONFIGURED" });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("records a failed reminder at warn, and reports one out of attempts", async () => {
    mocks.claim.mockResolvedValue([claim(1), claim(2, { attempts: 5 })]);
    mocks.send
      .mockRejectedValueOnce(new EmailSendError("validation_error", "Bad address a@b"))
      .mockRejectedValueOnce(new Error("socket hang up"));
    mocks.complete.mockResolvedValueOnce(2).mockResolvedValueOnce(5);

    const body = await (await run(request())).json();

    expect(body).toEqual({ claimed: 2, sent: 0, failed: 2, released: 0 });
    expect(mocks.complete).toHaveBeenCalledWith({}, "send-1", { sent: false, errorCode: "validation_error" });
    expect(mocks.warn).toHaveBeenCalledWith("event.reminder_failed", {
      sendId: "send-1",
      ticketId: "ticket-1",
      eventId: "event-1",
      kind: "1d",
      code: "validation_error",
      attempts: 2,
    });
    expect(mocks.error).toHaveBeenCalledWith("event.reminder_abandoned", {
      sendId: "send-2",
      ticketId: "ticket-2",
      eventId: "event-1",
      kind: "1d",
      code: "SEND_FAILED",
    });
    expect(mocks.flush).toHaveBeenCalledWith(2000);
  });

  it("returns a retryable failure when the claim fails", async () => {
    mocks.claim.mockRejectedValue(new Error("private row data"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.error).toHaveBeenCalledWith("event.reminder_claim_failed", { code: "08006" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
