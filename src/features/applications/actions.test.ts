/**
 * `submitApplication`'s "we received your application" email, with the
 * database helpers mocked: it goes once, after the response, only on the
 * submit RPC's real draft-to-submitted transition, and never fails a submit.
 * The database paths themselves are in `actions.integration.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicantApplicationRow } from "@/lib/supabase-helpers/event-applications";
import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const hoisted = vi.hoisted(() => ({
  /** Callbacks handed to `after`, run by the test as Next would. */
  afterCallbacks: [] as Array<() => unknown>,
  headers: vi.fn(),
}));
vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => {
    hoisted.afterCallbacks.push(callback);
  }),
}));
vi.mock("next/headers", () => ({ headers: hoisted.headers }));

const member = {
  id: "user-1",
  email: "member@uxhub.test",
  first_name: "Priya",
} as UserInfoRow;
vi.mock("@/lib/auth/guards", () => ({ requireAuth: vi.fn(async () => member) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));

const event = {
  id: "event-1",
  slug: "uxathon-2027",
  name: "UXathon 2027",
  requires_application: true,
  registration_opens_at: null,
  registration_closes_at: null,
} as EventRow;
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventById: vi.fn(async () => event) }));

const QUESTION_ID = "question-1";
vi.mock("@/lib/supabase-helpers/event-applications", () => ({
  fetchApplicationQuestions: vi.fn(async () => [
    {
      id: QUESTION_ID,
      question: "Why?",
      description: null,
      response_type: "short_text",
      is_required: true,
      max_char_limit: null,
      response_options: null,
    },
  ]),
  fetchUserEventApplication: vi.fn(),
  createDraftApplication: vi.fn(),
  upsertApplicationResponses: vi.fn(async () => undefined),
  submitEventApplication: vi.fn(),
}));

vi.mock("@/lib/email/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/client")>()),
  sendEmail: vi.fn(async () => true),
}));
vi.mock("@/lib/log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log")>()),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { EmailSendError, sendEmail } from "@/lib/email/client";
import { log } from "@/lib/log";
import {
  fetchUserEventApplication,
  submitEventApplication,
} from "@/lib/supabase-helpers/event-applications";

import { submitApplication } from "./actions";

const draft = (overrides: Partial<ApplicantApplicationRow> = {}): ApplicantApplicationRow => ({
  id: "application-1",
  event_id: event.id,
  user_id: member.id,
  status: "draft",
  offer_expires_at: null,
  submitted_at: null,
  created_at: "2026-11-20T00:00:00Z",
  updated_at: null,
  decisions_release_at: null,
  ...overrides,
});

const answers = { [QUESTION_ID]: "Because" };

/** Runs the callbacks queued with `after`, as Next does once the response is sent. */
async function flushAfter() {
  const callbacks = hoisted.afterCallbacks.splice(0);
  await Promise.all(callbacks.map((callback) => callback()));
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.afterCallbacks.length = 0;
  hoisted.headers.mockResolvedValue(
    new Headers({ host: "www.ubcuxhub.ca", "x-forwarded-proto": "https" })
  );
  vi.mocked(fetchUserEventApplication).mockResolvedValue(draft());
  vi.mocked(submitEventApplication).mockResolvedValue({
    status: "SUBMITTED",
    missingQuestionIds: [],
  });
  vi.mocked(sendEmail).mockResolvedValue(true);
});

describe("submitApplication's received email", () => {
  it("sends once, after the response, to the account email", async () => {
    const result = await submitApplication(event.id, answers);

    expect(result).toEqual({ ok: true, applicationId: "application-1" });
    // Queued, not sent, by the time the action returns.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(hoisted.afterCallbacks).toHaveLength(1);

    await flushAfter();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.to).toBe("member@uxhub.test");
    expect(email.subject).toBe("We received your application to UXathon 2027");
    expect(email.html).toContain(
      'href="https://www.ubcuxhub.ca/portal/events/uxathon-2027/apply"'
    );
    expect(email.html).toContain("UX Hub execs will review it and let you know.");
  });

  it("names the release date when it is still ahead", async () => {
    await submitApplication(event.id, answers);
    vi.mocked(fetchUserEventApplication).mockResolvedValue(
      draft({ status: "submitted", decisions_release_at: "2099-11-26T06:45:00Z" })
    );
    await flushAfter();

    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.html).toContain("you’ll hear from us by Wed, Nov 25, 2099.");
  });

  it("leaves out a release date that has passed", async () => {
    await submitApplication(event.id, answers);
    vi.mocked(fetchUserEventApplication).mockResolvedValue(
      draft({ status: "submitted", decisions_release_at: "2020-01-01T00:00:00Z" })
    );
    await flushAfter();

    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.html).toContain("UX Hub execs will review it and let you know.");
  });

  it("doesn't send when the submit RPC reports it was already submitted", async () => {
    vi.mocked(submitEventApplication).mockResolvedValue({
      status: "NOT_DRAFT",
      missingQuestionIds: [],
    });

    const result = await submitApplication(event.id, answers);
    await flushAfter();

    expect(result).toMatchObject({ ok: false });
    expect(hoisted.afterCallbacks).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't send on a repeat submit of a submitted application", async () => {
    vi.mocked(fetchUserEventApplication).mockResolvedValue(draft({ status: "submitted" }));

    const result = await submitApplication(event.id, answers);
    await flushAfter();

    expect(result).toMatchObject({ ok: false, reason: "submitted" });
    expect(submitEventApplication).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't send when the submit fails or is incomplete", async () => {
    vi.mocked(submitEventApplication).mockRejectedValueOnce(new Error("boom"));
    expect(await submitApplication(event.id, answers)).toMatchObject({ ok: false });

    vi.mocked(submitEventApplication).mockResolvedValueOnce({
      status: "INCOMPLETE",
      missingQuestionIds: [QUESTION_ID],
    });
    expect(await submitApplication(event.id, answers)).toMatchObject({ ok: false });

    await flushAfter();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still succeeds when the send throws, and logs a warning by id", async () => {
    vi.mocked(sendEmail).mockRejectedValue(
      new EmailSendError("validation_error", "Invalid `to` field: member@uxhub.test")
    );

    const result = await submitApplication(event.id, answers);
    await expect(flushAfter()).resolves.toBeUndefined();

    expect(result).toEqual({ ok: true, applicationId: "application-1" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith("application.received_email_failed", {
      applicationId: "application-1",
      code: "validation_error",
      errorType: "EmailSendError",
    });
    expect(log.error).not.toHaveBeenCalled();
  });

  it("still succeeds when the email can't be queued", async () => {
    hoisted.headers.mockRejectedValue(new Error("no request scope"));

    const result = await submitApplication(event.id, answers);

    expect(result).toEqual({ ok: true, applicationId: "application-1" });
    expect(hoisted.afterCallbacks).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith("application.received_email_failed", {
      applicationId: "application-1",
      errorType: "Error",
    });
  });

  it("still sends, undated, when the release date can't be read", async () => {
    await submitApplication(event.id, answers);
    vi.mocked(fetchUserEventApplication).mockRejectedValue(new Error("down"));
    await flushAfter();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = vi.mocked(sendEmail).mock.calls[0];
    expect(email.html).toContain("UX Hub execs will review it and let you know.");
  });
});
