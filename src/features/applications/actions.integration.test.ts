/**
 * The application page's server actions against the local database, acting as
 * a member through `clientAs`: saving a draft, submitting it (with and without
 * gaps) and file answers. Each test makes its own event and
 * questions, since CI's database is unseeded.
 */
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import type { UserInfoRow } from "@/lib/supabase/models";
import { BUCKETS } from "@/lib/supabase-helpers/buckets";
import {
  applicationFilePath,
  uploadApplicationFile,
} from "@/lib/supabase-helpers/application-files";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ member: null as UserInfoRow | null }));
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(async () => {
    if (!session.member) throw new Error("No member signed in.");
    return session.member;
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => clientAs(session.member)),
}));
// The received email: `after` queues it for `flushAfter`, and nothing is sent.
const queued = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void queued.push(callback) }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "www.ubcuxhub.ca", "x-forwarded-proto": "https" }),
}));
vi.mock("@/lib/email/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/client")>()),
  sendEmail: vi.fn(async () => true),
}));

import { sendEmail } from "@/lib/email/client";

import {
  saveApplicationDraft,
  startApplicationDraft,
  submitApplication,
} from "./actions";

const db = createIntegrationClient();
const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const pdf = () => new Blob(["%PDF-1.4\n%integration\n"], { type: "application/pdf" });

type QuestionInsert = Database["public"]["Tables"]["event_application_questions"]["Insert"];

/** A member signed in for the actions, and an event taking applications. */
async function setUp(
  fixtures: Fixtures,
  eventOverrides: Partial<Database["public"]["Tables"]["events"]["Insert"]> = {},
  memberOverrides: Partial<Database["public"]["Tables"]["user_info"]["Insert"]> = {}
) {
  const member = await fixtures.createUser(memberOverrides);
  session.member = member;
  const event = await fixtures.createEvent({
    status: "active",
    requires_application: true,
    registration_opens_at: at(-hour),
    registration_closes_at: at(hour),
    ...eventOverrides,
  });
  const rows: Omit<QuestionInsert, "event_id">[] = [
    { question: "Why?", response_type: "long_text", max_char_limit: 20, sort_order: 0 },
    {
      question: "Pick any",
      response_type: "checkbox",
      response_options: ["Research", "Design, UI"],
      sort_order: 1,
    },
    { question: "Year", response_type: "multiple_choice", response_options: ["1", "2"], sort_order: 2 },
    { question: "Resume", response_type: "file_upload", is_required: false, sort_order: 3 },
  ];
  const { data, error } = await db
    .from("event_application_questions")
    .insert(rows.map((row) => ({ is_required: true, ...row, event_id: event.id })))
    .select("id, question");
  if (error) throw error;
  const id = (question: string) => data.find((row) => row.question === question)!.id;

  return {
    member,
    event,
    q: { why: id("Why?"), pick: id("Pick any"), year: id("Year"), resume: id("Resume") },
  };
}

/** Runs what `after` queued, as Next does once the response is sent. */
async function flushAfter() {
  await Promise.all(queued.splice(0).map((callback) => callback()));
}

async function applicationOf(eventId: string, userId: string) {
  const { data, error } = await db
    .from("event_applications")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function responsesOf(applicationId: string) {
  const { data, error } = await db
    .from("event_application_responses")
    .select("event_application_question_id, response")
    .eq("application_id", applicationId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.event_application_question_id, row.response]));
}

describe("saveApplicationDraft", () => {
  it("starts the draft on the first save and updates answers by question id", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures);

      const first = await saveApplicationDraft(event.id, { [q.why]: "Because", [q.pick]: ["Design, UI"] });
      expect(first.ok).toBe(true);
      const application = await applicationOf(event.id, member.id);
      expect(application?.status).toBe("draft");
      expect(first.ok && first.applicationId).toBe(application?.id);

      const second = await saveApplicationDraft(event.id, { [q.why]: "Changed", [q.year]: "2" });
      expect(second).toEqual({ ok: true, applicationId: application!.id });
      expect(await responsesOf(application!.id)).toEqual({
        [q.why]: "Changed",
        [q.pick]: '["Design, UI"]',
        [q.year]: "2",
      });
    }));

  it("refuses answers outside the options or the limit without saving", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures);

      const result = await saveApplicationDraft(event.id, {
        [q.why]: "x".repeat(21),
        [q.year]: "7",
      });
      expect(result).toMatchObject({
        ok: false,
        fieldErrors: {
          [q.why]: "Keep your answer to 20 characters or fewer.",
          [q.year]: "Choose one of the listed options.",
        },
      });
      expect(await applicationOf(event.id, member.id)).toBeNull();
    }));

  it("won't start a draft outside the registration window", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures, {
        registration_opens_at: at(-2 * hour),
        registration_closes_at: at(-hour),
      });

      expect(await saveApplicationDraft(event.id, { [q.why]: "Late" })).toEqual({
        ok: false,
        error: "Applications for this event have closed.",
        reason: "closed",
      });
      expect(await applicationOf(event.id, member.id)).toBeNull();
    }));

  it("stops saving a draft once the window closes", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures);
      expect((await saveApplicationDraft(event.id, { [q.why]: "Before" })).ok).toBe(true);
      const application = await applicationOf(event.id, member.id);

      const { error } = await db
        .from("events")
        .update({ registration_opens_at: at(-2 * hour), registration_closes_at: at(-hour) })
        .eq("id", event.id);
      if (error) throw error;

      expect(await saveApplicationDraft(event.id, { [q.why]: "After" })).toEqual({
        ok: false,
        error: "Applications for this event have closed.",
        reason: "closed",
      });
      expect(await responsesOf(application!.id)).toEqual({ [q.why]: "Before" });
    }));

  it("refuses an event that takes no applications", () =>
    withFixtures(async (fixtures) => {
      const { event, q } = await setUp(fixtures, { requires_application: false });
      expect(await saveApplicationDraft(event.id, { [q.why]: "Hi" })).toEqual({
        ok: false,
        error: "This event doesn't take applications.",
        reason: "not_accepting",
      });
    }));
});

describe("submitApplication", () => {
  // The portal page offers Apply on a draft to the admins and managers who can
  // see it (docs/event-states.md, "Drafts for admins"); the insert policy and
  // submit_event_application both allow is_admin() on a draft.
  it.each(["admin", "manager"] as const)("lets a %s apply to a draft event", (role) =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures, { status: "draft" }, { role_access: role });

      const result = await submitApplication(event.id, {
        [q.why]: "Testing",
        [q.pick]: ["Research"],
        [q.year]: "1",
        [q.resume]: "",
      });
      expect(result).toEqual({ ok: true, applicationId: expect.any(String) });
      expect((await applicationOf(event.id, member.id))?.status).toBe("submitted");
    }));

  it("refuses a member's application to a draft event", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures, { status: "draft" });

      expect(await submitApplication(event.id, { [q.why]: "Early" })).toMatchObject({
        ok: false,
        reason: "not_accepting",
      });
      expect(await applicationOf(event.id, member.id)).toBeNull();
    }));

  it("saves the answers and names the questions to fix", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures);

      const result = await submitApplication(event.id, {
        [q.why]: "Because",
        [q.pick]: [],
        [q.year]: "",
        [q.resume]: "",
      });
      expect(result).toMatchObject({
        ok: false,
        saved: true,
        fieldErrors: {
          [q.pick]: "Choose at least one option.",
          [q.year]: "Choose an answer.",
        },
      });
      expect(Object.keys(result.ok ? {} : result.fieldErrors ?? {})).toEqual([q.pick, q.year]);
      const application = await applicationOf(event.id, member.id);
      expect(application?.status).toBe("draft");
      expect((await responsesOf(application!.id))[q.why]).toBe("Because");
    }));

  it("submits a complete application with its file, after which it is final", () =>
    withFixtures(async (fixtures) => {
      const { member, event, q } = await setUp(fixtures);

      const draft = await startApplicationDraft(event.id);
      if (!draft.ok) throw new Error(draft.error);
      expect(draft.userInfoId).toBe(member.id);
      const path = applicationFilePath({
        userInfoId: member.id,
        applicationId: draft.applicationId,
        questionId: q.resume,
        fileName: "Resume.pdf",
      });
      fixtures.trackStorage(BUCKETS.applicationFiles, path.slice(0, path.lastIndexOf("/")));
      await uploadApplicationFile(clientAs(member), path, pdf());

      const answers = {
        [q.why]: "Because",
        [q.pick]: ["Research", "Design, UI"],
        [q.year]: "1",
        [q.resume]: path,
      };
      expect(await submitApplication(event.id, answers)).toEqual({
        ok: true,
        applicationId: draft.applicationId,
      });
      expect((await applicationOf(event.id, member.id))?.status).toBe("submitted");

      expect(await saveApplicationDraft(event.id, { [q.why]: "Edited" })).toEqual({
        ok: false,
        error: "You've already submitted this application.",
        reason: "submitted",
      });
      expect((await applicationOf(event.id, member.id))?.status).toBe("submitted");
    }));

  it("emails the applicant once, on the submit itself, with the release date", () =>
    withFixtures(async (fixtures) => {
      vi.mocked(sendEmail).mockClear();
      queued.length = 0;
      const { member, event, q } = await setUp(fixtures);
      // 11:45 PM Pacific on a known date, well after the window closes.
      const { error } = await db
        .from("event_application_settings")
        .upsert({ event_id: event.id, decisions_release_at: "2099-11-26T06:45:00Z" });
      if (error) throw error;
      const answers = { [q.why]: "Because", [q.pick]: ["Research"], [q.year]: "1", [q.resume]: "" };

      // Two submits at once: the RPC lets one through, and only it emails.
      const results = await Promise.all([
        submitApplication(event.id, answers),
        submitApplication(event.id, answers),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      // A retry afterwards is refused before the RPC.
      expect(await submitApplication(event.id, answers)).toMatchObject({ ok: false, reason: "submitted" });
      await flushAfter();

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [email] = vi.mocked(sendEmail).mock.calls[0];
      expect(email.to).toBe(member.email);
      expect(email.subject).toBe(`We received your application to ${event.name}`);
      expect(email.html).toContain("you’ll hear from us by Wed, Nov 25, 2099.");
      expect(email.html).toContain(
        `href="https://www.ubcuxhub.ca/portal/events/${encodeURIComponent(event.slug!)}/apply"`
      );
    }));

  it("refuses a file answer that isn't the member's own upload", () =>
    withFixtures(async (fixtures) => {
      const { event, q } = await setUp(fixtures);

      const result = await saveApplicationDraft(event.id, {
        [q.resume]: "someone-else/app/question/resume.pdf",
      });
      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { [q.resume]: "Upload the file again." },
      });
    }));
});
