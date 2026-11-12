/**
 * Application drafts against the local database: the draft helpers,
 * submit_event_application, the application-files bucket, and what admins see.
 * Each test makes its own event and questions, since CI's database is unseeded.
 */
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { encodeCheckboxResponse } from "@/lib/application-response";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

import {
  applicationFilePath,
  listApplicationFiles,
  uploadApplicationFile,
} from "./application-files";
import { BUCKETS } from "./buckets";
import {
  createDraftApplication,
  deleteDraftApplication,
  fetchEventApplicationSummaries,
  submitEventApplication,
  upsertApplicationResponses,
} from "./event-applications";

const db = createIntegrationClient();

type QuestionInsert = Database["public"]["Tables"]["event_application_questions"]["Insert"];

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const pdf = () => new Blob(["%PDF-1.4\n%integration\n"], { type: "application/pdf" });

/** An open event taking applications, with one question of each kind. */
async function applicationEvent(
  fixtures: Fixtures,
  overrides: Partial<Database["public"]["Tables"]["events"]["Insert"]> = {}
) {
  const event = await fixtures.createEvent({
    status: "active",
    requires_application: true,
    registration_opens_at: at(-hour),
    registration_closes_at: at(hour),
    ...overrides,
  });
  const rows: Omit<QuestionInsert, "event_id">[] = [
    { question: "Why?", response_type: "long_text", max_char_limit: 20, sort_order: 0 },
    {
      question: "Pick any",
      response_type: "checkbox",
      response_options: ["Research", "Design, UI"],
      sort_order: 1,
    },
    {
      question: "Year",
      response_type: "dropdown",
      response_options: ["1", "2", "3"],
      sort_order: 2,
    },
    { question: "Teammates", response_type: "short_text", is_required: false, sort_order: 3 },
    { question: "Resume", response_type: "file_upload", sort_order: 4 },
  ];
  // A bulk insert sends every row the union of their keys, filling the gaps
  // with null rather than the column default, so name is_required on each.
  const { data, error } = await db
    .from("event_application_questions")
    .insert(rows.map((row) => ({ is_required: true, ...row, event_id: event.id })))
    .select("id, question");
  if (error) throw error;

  const id = (question: string) => data.find((row) => row.question === question)!.id;
  return {
    event,
    questions: {
      why: id("Why?"),
      pick: id("Pick any"),
      year: id("Year"),
      teammates: id("Teammates"),
      resume: id("Resume"),
    },
  };
}

async function statusOf(applicationId: string) {
  const { data, error } = await db
    .from("event_applications")
    .select("status, submitted_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

describe("submit_event_application", () => {
  it("submits a complete draft, file and all", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const { event, questions } = await applicationEvent(fixtures);
      const client = clientAs(member);

      const draft = await createDraftApplication(client, event.id, member.id);
      expect(draft.status).toBe("draft");
      expect(draft.submitted_at).toBeNull();
      // A second start returns the same draft rather than failing.
      expect((await createDraftApplication(client, event.id, member.id)).id).toBe(draft.id);

      const path = applicationFilePath({
        userInfoId: member.id,
        applicationId: draft.id,
        questionId: questions.resume,
        fileName: "My resume.pdf",
      });
      fixtures.trackStorage(BUCKETS.applicationFiles, path.slice(0, path.lastIndexOf("/")));
      await uploadApplicationFile(client, path, pdf());

      await upsertApplicationResponses(client, [
        { application_id: draft.id, event_application_question_id: questions.why, response: "Because" },
        {
          application_id: draft.id,
          event_application_question_id: questions.pick,
          response: encodeCheckboxResponse(["Design, UI"]),
        },
        { application_id: draft.id, event_application_question_id: questions.year, response: "2" },
        { application_id: draft.id, event_application_question_id: questions.resume, response: path },
      ]);

      expect(await submitEventApplication(client, draft.id)).toEqual({
        status: "SUBMITTED",
        missingQuestionIds: [],
      });
      const submitted = await statusOf(draft.id);
      expect(submitted?.status).toBe("submitted");
      expect(submitted?.submitted_at).toBeTruthy();

      // Final now: no more edits, deletes, or second submit.
      await expect(
        upsertApplicationResponses(client, [
          { application_id: draft.id, event_application_question_id: questions.why, response: "Edited" },
        ])
      ).rejects.toBeTruthy();
      expect(await deleteDraftApplication(client, { applicationId: draft.id, userInfoId: member.id }))
        .toBe(false);
      expect((await submitEventApplication(client, draft.id)).status).toBe("NOT_DRAFT");
    }));

  it("lists the questions to fix, in order, and leaves the draft a draft", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const { event, questions } = await applicationEvent(fixtures);
      const client = clientAs(member);
      const draft = await createDraftApplication(client, event.id, member.id);

      await upsertApplicationResponses(client, [
        // Over max_char_limit.
        {
          application_id: draft.id,
          event_application_question_id: questions.why,
          response: "x".repeat(21),
        },
        // An empty selection.
        { application_id: draft.id, event_application_question_id: questions.pick, response: "[]" },
        { application_id: draft.id, event_application_question_id: questions.year, response: "1" },
        // A key that was never uploaded.
        {
          application_id: draft.id,
          event_application_question_id: questions.resume,
          response: `${member.id}/${draft.id}/${questions.resume}/missing.pdf`,
        },
      ]);

      expect(await submitEventApplication(client, draft.id)).toEqual({
        status: "INCOMPLETE",
        missingQuestionIds: [questions.why, questions.pick, questions.resume],
      });
      expect((await statusOf(draft.id))?.status).toBe("draft");
    }));

  it("refuses outside the registration window", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const { event: closed } = await applicationEvent(fixtures, {
        registration_opens_at: at(-2 * hour),
        registration_closes_at: at(-hour),
      });
      const { event: notOpen } = await applicationEvent(fixtures, {
        slug: `not-open-${fixtures.tag}`,
        registration_opens_at: at(hour),
        registration_closes_at: at(2 * hour),
      });
      const client = clientAs(member);

      // Members cannot start one there either, so these drafts were started
      // while it was open.
      await expect(createDraftApplication(client, closed.id, member.id)).rejects.toBeTruthy();
      const { data: drafts, error } = await db
        .from("event_applications")
        .insert([
          { event_id: closed.id, user_id: member.id, status: "draft" },
          { event_id: notOpen.id, user_id: member.id, status: "draft" },
        ])
        .select("id, event_id");
      if (error) throw error;
      const draftFor = (eventId: string) => drafts.find((row) => row.event_id === eventId)!.id;

      expect((await submitEventApplication(client, draftFor(closed.id))).status).toBe(
        "REGISTRATION_CLOSED"
      );
      expect((await submitEventApplication(client, draftFor(notOpen.id))).status).toBe(
        "REGISTRATION_NOT_OPEN"
      );
      expect((await statusOf(draftFor(closed.id)))?.status).toBe("draft");
    }));

  it("refuses someone else's draft", () =>
    withFixtures(async (fixtures) => {
      const [member, other] = [await fixtures.createUser(), await fixtures.createUser()];
      const { event } = await applicationEvent(fixtures);
      const draft = await createDraftApplication(clientAs(other), event.id, other.id);

      expect(await submitEventApplication(clientAs(member), draft.id)).toEqual({
        status: "NOT_FOUND",
        missingQuestionIds: [],
      });
      expect(
        await deleteDraftApplication(clientAs(member), { applicationId: draft.id, userInfoId: other.id })
      ).toBe(false);
      expect((await statusOf(draft.id))?.status).toBe("draft");
    }));
});

describe("application drafts", () => {
  it("deletes a draft with its answers and files", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const { event, questions } = await applicationEvent(fixtures);
      const client = clientAs(member);
      const draft = await createDraftApplication(client, event.id, member.id);
      const path = applicationFilePath({
        userInfoId: member.id,
        applicationId: draft.id,
        questionId: questions.resume,
        fileName: "cv.pdf",
      });
      fixtures.trackStorage(BUCKETS.applicationFiles, path.slice(0, path.lastIndexOf("/")));
      await uploadApplicationFile(client, path, pdf());
      await upsertApplicationResponses(client, [
        { application_id: draft.id, event_application_question_id: questions.why, response: "Hi" },
      ]);

      expect(await listApplicationFiles(client, { userInfoId: member.id, applicationId: draft.id }))
        .toEqual([path]);
      expect(await deleteDraftApplication(client, { applicationId: draft.id, userInfoId: member.id }))
        .toBe(true);

      expect(await statusOf(draft.id)).toBeNull();
      const { data: responses } = await db
        .from("event_application_responses")
        .select("id")
        .eq("application_id", draft.id);
      expect(responses).toEqual([]);
      expect(await listApplicationFiles(db, { userInfoId: member.id, applicationId: draft.id }))
        .toEqual([]);
    }));

  it("takes only PDFs into the bucket", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const { event, questions } = await applicationEvent(fixtures);
      const client = clientAs(member);
      const draft = await createDraftApplication(client, event.id, member.id);
      const folder = `${member.id}/${draft.id}/${questions.resume}`;
      fixtures.trackStorage(BUCKETS.applicationFiles, folder);

      const { error } = await client.storage
        .from(BUCKETS.applicationFiles)
        .upload(`${folder}/photo.png`, new Blob(["png"], { type: "image/png" }), {
          contentType: "image/png",
        });
      expect(error).toBeTruthy();

      // Nor anywhere but under a file question of the member's own draft.
      await expect(
        uploadApplicationFile(client, `${member.id}/${draft.id}/${questions.why}/cv.pdf`, pdf())
      ).rejects.toBeTruthy();
    }));

  it("keeps drafts out of the admin review list", () =>
    withFixtures(async (fixtures) => {
      const [drafter, submitter] = [await fixtures.createUser(), await fixtures.createUser()];
      const admin = await fixtures.createUser({ role_access: "admin" });
      const { event } = await applicationEvent(fixtures);

      await createDraftApplication(clientAs(drafter), event.id, drafter.id);
      const { data: submitted, error } = await db
        .from("event_applications")
        .insert({ event_id: event.id, user_id: submitter.id })
        .select()
        .single();
      if (error) throw error;
      expect(submitted.submitted_at).toBeTruthy();

      for (const client of [clientAs(admin), db]) {
        const summaries = await fetchEventApplicationSummaries(client, event.id);
        expect(summaries.map((summary) => summary.applicationId)).toEqual([submitted.id]);
        expect(summaries[0].appliedAt).toBe(submitted.submitted_at);
      }
    }));
});
