/**
 * save_admin_event_atomically and the questions people have applied with:
 * saves keep question ids, and so the answers to them, and refuse changes
 * that would lose or misread submitted answers. Each test makes its own event,
 * applicants and answers, since CI's database is unseeded.
 */
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { withFixtures, type Fixtures } from "@/test/integration";

type ResponseType = Database["public"]["Enums"]["response_type"];
type ApplicationStatus = Database["public"]["Enums"]["event_application_status"];

interface QuestionInput {
  id?: string | null;
  question: string;
  response_type: ResponseType;
  is_required?: boolean;
  sort_order?: number;
  description?: string | null;
  max_char_limit?: number | null;
  response_options?: string[] | null;
  restrict_file_types?: boolean;
  allowed_file_types?: string[] | null;
  max_file_size_bytes?: number | null;
}

interface SaveResult {
  id: string;
  question_ids: string[];
  removed_files: string[];
}

function eventPayload(fixtures: Fixtures, name = `Applications ${fixtures.tag}`) {
  return {
    name,
    description: "Application question integration test.",
    status: "draft" as const,
    event_type: "regular" as const,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: true,
    regular_price: 0,
    member_price: 0,
    max_capacity: 10,
    created_at: new Date().toISOString(),
  };
}

let slugCount = 0;

/** Numbers each question's sort_order by its position, as the builder does. */
function inOrder(questions: QuestionInput[]) {
  return questions.map((question, index) => ({ sort_order: index, ...question }));
}

async function attemptSave(
  fixtures: Fixtures,
  questions: QuestionInput[],
  eventId?: string,
  name?: string
) {
  return fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId ?? null!,
    p_event: eventPayload(fixtures, name),
    p_slug: eventId ? null! : `applications-${fixtures.tag}-${++slugCount}`,
    p_expected_image_url: null!,
    p_check_in_sessions: [],
    p_application_questions: inOrder(questions) as never,
    p_mentors: [],
    p_sponsors: [],
  });
}

async function save(
  fixtures: Fixtures,
  questions: QuestionInput[],
  eventId?: string,
  name?: string
): Promise<SaveResult> {
  const { data, error } = await attemptSave(fixtures, questions, eventId, name);
  if (error) throw error;
  const result = data as unknown as SaveResult;
  if (!eventId) fixtures.track("events", result.id);
  return result;
}

async function questionsOf(fixtures: Fixtures, eventId: string) {
  const { data, error } = await fixtures.supabase
    .from("event_application_questions")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

/** An applicant's application, written directly with the given answers. */
async function apply(
  fixtures: Fixtures,
  eventId: string,
  status: ApplicationStatus,
  answers: Record<string, string>
) {
  const user = await fixtures.createUser();
  const { data: application, error } = await fixtures.supabase
    .from("event_applications")
    .insert({ event_id: eventId, user_id: user.id, status, ...(status === "accepted" ? { offer_expires_at: "2099-01-01T00:00:00Z" } : {}) })
    .select()
    .single();
  if (error) throw error;

  const rows = Object.entries(answers).map(([questionId, response]) => ({
    application_id: application.id,
    event_application_question_id: questionId,
    response,
  }));
  if (rows.length > 0) {
    const { error: responseError } = await fixtures.supabase
      .from("event_application_responses")
      .insert(rows);
    if (responseError) throw responseError;
  }
  return application.id;
}

async function answersOf(fixtures: Fixtures, applicationId: string) {
  const { data, error } = await fixtures.supabase
    .from("event_application_responses")
    .select("event_application_question_id, response")
    .eq("application_id", applicationId);
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [row.event_application_question_id, row.response])
  );
}

const why: QuestionInput = { question: "Why?", response_type: "long_text", max_char_limit: 500 };
const team: QuestionInput = { question: "Team?", response_type: "short_text" };
const year: QuestionInput = {
  question: "Year",
  response_type: "dropdown",
  response_options: ["1", "2", "3"],
};
const resume: QuestionInput = { question: "Resume", response_type: "file_upload" };

describe("save_admin_event_atomically: application questions", () => {
  it("keeps question ids and every answer when the questions are unchanged", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, team, year]);
      const [whyId, teamId, yearId] = created.question_ids;
      const submitted = await apply(fixtures, created.id, "submitted", {
        [whyId]: "Because",
        [yearId]: "2",
      });
      const draft = await apply(fixtures, created.id, "draft", { [teamId]: "Ana" });

      const saved = await save(
        fixtures,
        [
          { ...why, id: whyId },
          { ...team, id: teamId },
          { ...year, id: yearId },
        ],
        created.id,
        `Renamed ${fixtures.tag}`
      );

      expect(saved.question_ids).toEqual([whyId, teamId, yearId]);
      expect(saved.removed_files).toEqual([]);
      expect((await questionsOf(fixtures, created.id)).map((row) => row.id)).toEqual([
        whyId,
        teamId,
        yearId,
      ]);
      expect(await answersOf(fixtures, submitted)).toEqual({
        [whyId]: "Because",
        [yearId]: "2",
      });
      expect(await answersOf(fixtures, draft)).toEqual({ [teamId]: "Ana" });
    }));

  it("edits, reorders, adds and removes questions by id", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, team, year]);
      const [whyId, teamId, yearId] = created.question_ids;
      const submitted = await apply(fixtures, created.id, "draft", {
        [whyId]: "Because",
        [yearId]: "2",
      });
      // Draft answers do not stop a question from being removed.
      const draft = await apply(fixtures, created.id, "draft", {
        [teamId]: "Ana",
        [yearId]: "1",
      });

      const saved = await save(
        fixtures,
        [
          { ...year, id: yearId, response_options: ["1", "2", "3", "4+"] },
          { ...why, id: whyId, question: "Why do you want to come?", is_required: true },
          { question: "Portfolio link", response_type: "short_text", id: null },
        ],
        created.id
      );

      const rows = await questionsOf(fixtures, created.id);
      expect(saved.question_ids.slice(0, 2)).toEqual([yearId, whyId]);
      expect(rows.map((row) => [row.id, row.question, row.sort_order])).toEqual([
        [yearId, "Year", 0],
        [whyId, "Why do you want to come?", 1],
        [saved.question_ids[2], "Portfolio link", 2],
      ]);
      expect(rows[0].response_options).toEqual(["1", "2", "3", "4+"]);
      expect(rows[1].is_required).toBe(true);
      expect(rows.some((row) => row.id === teamId)).toBe(false);

      expect(await answersOf(fixtures, submitted)).toEqual({
        [whyId]: "Because",
        [yearId]: "2",
      });
      expect(await answersOf(fixtures, draft)).toEqual({ [yearId]: "1" });
    }));

  it("refuses to remove a question answered on a submitted application, and saves nothing", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, team]);
      const [whyId, teamId] = created.question_ids;
      const submitted = await apply(fixtures, created.id, "submitted", { [whyId]: "Because" });

      const { error } = await attemptSave(
        fixtures,
        [{ ...team, id: teamId, question: "Teammates?" }],
        created.id,
        `Renamed ${fixtures.tag}`
      );

      expect(error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
      expect(error?.message).toBe(
        'Application questions are locked after the first submitted application. Reload the event form.'
      );
      const rows = await questionsOf(fixtures, created.id);
      expect(rows.map((row) => [row.id, row.question])).toEqual([
        [whyId, "Why?"],
        [teamId, "Team?"],
      ]);
      const { data: event } = await fixtures.supabase
        .from("events")
        .select("name")
        .eq("id", created.id)
        .single();
      expect(event?.name).toBe(`Applications ${fixtures.tag}`);
      expect(await answersOf(fixtures, submitted)).toEqual({ [whyId]: "Because" });
    }));

  it("locks even optional questions whose submitted answers are blank", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, { ...team, is_required: false }]);
      const [whyId, teamId] = created.question_ids;
      await apply(fixtures, created.id, "submitted", { [whyId]: "Because", [teamId]: "  " });

      const { error } = await attemptSave(fixtures, [{ ...why, id: whyId }], created.id);
      expect(error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
      expect((await questionsOf(fixtures, created.id)).map(row => row.id)).toEqual([whyId, teamId]);
    }));

  it("returns the files answering a removed file question, from drafts", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, resume]);
      const [whyId, resumeId] = created.question_ids;
      const path = `user/application/${resumeId}/cv.pdf`;
      const draft = await apply(fixtures, created.id, "draft", {
        [whyId]: "Because",
        [resumeId]: path,
      });
      await apply(fixtures, created.id, "draft", { [resumeId]: "" });

      const saved = await save(fixtures, [{ ...why, id: whyId }], created.id);

      expect(saved.removed_files).toEqual([path]);
      expect(await answersOf(fixtures, draft)).toEqual({ [whyId]: "Because" });
    }));

  it("refuses to change the response type of an answered question", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [why, team]);
      const [whyId, teamId] = created.question_ids;
      // A draft answer is enough: it was written in the old type's encoding.
      await apply(fixtures, created.id, "draft", { [whyId]: "Because", [teamId]: "" });

      const { error } = await attemptSave(
        fixtures,
        [
          { ...why, id: whyId, response_type: "checkbox", response_options: ["A"] },
          { ...team, id: teamId },
        ],
        created.id
      );
      expect(error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
      expect(error?.message).toBe(
        '"Why?" already has answers, so its response type cannot change. Add a new question instead.'
      );

      // A blank answer does not count.
      const saved = await save(
        fixtures,
        [
          { ...why, id: whyId },
          { ...team, id: teamId, response_type: "long_text" },
        ],
        created.id
      );
      expect(saved.question_ids).toEqual([whyId, teamId]);
      expect((await questionsOf(fixtures, created.id))[1].response_type).toBe("long_text");
    }));

  it("refuses a question id that is not this event's", () =>
    withFixtures(async (fixtures) => {
      const other = await save(fixtures, [why]);
      const created = await save(fixtures, [team], undefined, `Second ${fixtures.tag}`);

      const { error } = await attemptSave(
        fixtures,
        [{ ...why, id: other.question_ids[0] }],
        created.id
      );

      expect(error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
      expect(error?.message).toMatch(/Reload the page/);
      expect((await questionsOf(fixtures, other.id)).map((row) => row.id)).toEqual(
        other.question_ids
      );
    }));

  it("gives file questions the bucket's rule, whatever the payload says", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [
        {
          ...resume,
          restrict_file_types: true,
          allowed_file_types: ["png", "jpeg"],
          max_file_size_bytes: 104_857_600,
        },
        { ...team, restrict_file_types: true, allowed_file_types: ["png"] },
      ]);

      const [file, text] = await questionsOf(fixtures, created.id);
      expect(file).toMatchObject({
        restrict_file_types: true,
        allowed_file_types: ["pdf"],
        max_file_size_bytes: 5_242_880,
      });
      expect(text).toMatchObject({
        restrict_file_types: false,
        allowed_file_types: null,
        max_file_size_bytes: null,
      });
    }));

  describe("the production builder's payload, which has no ids", () => {
    const legacy = (questions: QuestionInput[]) =>
      questions.map((question) => {
        const copy = { ...question };
        delete copy.id;
        return copy;
      });

    it("keeps unchanged questions and their answers", () =>
      withFixtures(async (fixtures) => {
        const created = await save(fixtures, [why, team, year]);
        const [whyId, teamId, yearId] = created.question_ids;
        const submitted = await apply(fixtures, created.id, "submitted", {
          [whyId]: "Because",
          [yearId]: "2",
        });

        // Unchanged, then with a question appended and one reworded.
        const unchanged = await save(fixtures, legacy([why, team, year]), created.id);
        expect(unchanged.question_ids).toEqual([whyId, teamId, yearId]);

        const edited = await attemptSave(fixtures, legacy([why, { ...team, question: "Teammates?" }, year, resume]), created.id);
        expect(edited.error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
        expect((await questionsOf(fixtures, created.id)).map(row => row.id)).toEqual([whyId, teamId, yearId]);
        expect(await answersOf(fixtures, submitted)).toEqual({
          [whyId]: "Because",
          [yearId]: "2",
        });
      }));

    it("refuses to drop a question answered on a submitted application", () =>
      withFixtures(async (fixtures) => {
        const created = await save(fixtures, [why, team]);
        const [whyId] = created.question_ids;
        await apply(fixtures, created.id, "submitted", { [whyId]: "Because" });

        // Removing the first question moves the second into its place.
        const { error } = await attemptSave(fixtures, legacy([team]), created.id);

        expect(error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
        expect((await questionsOf(fixtures, created.id)).map((row) => row.id)).toEqual(
          created.question_ids
        );
      }));
  });
});


describe("submitted question lock", () => {
  it.each(["submitted", "accepted", "waitlisted", "rejected"] as const)("rejects every edit for %s, even without answers, preserving descriptions and ids", status => withFixtures(async fixtures => {
    const created = await save(fixtures, [{ ...why, description: "Historical instructions" }, year]);
    const original = await questionsOf(fixtures, created.id);
    await apply(fixtures, created.id, status, {});
    const unchanged = original.map(q => ({ ...q, id: q.id }));
    expect((await attemptSave(fixtures, unchanged, created.id)).error).toBeNull();
    const changes = [
      [{ ...unchanged[0], question: "New text" }, unchanged[1]],
      [{ ...unchanged[0], description: null }, unchanged[1]],
      [{ ...unchanged[0], is_required: true }, unchanged[1]],
      [{ ...unchanged[0], max_char_limit: 600 }, unchanged[1]],
      [unchanged[0], { ...unchanged[1], response_options: ["New"] }],
      [{ ...unchanged[1], sort_order: 0 }, { ...unchanged[0], sort_order: 1 }],
      [unchanged[0]],
      [...unchanged, team],
      unchanged.map(q => ({ ...q, id: null })),
    ];
    for (const questions of changes) expect((await attemptSave(fixtures, questions, created.id)).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    const direct = await fixtures.supabase.from("event_application_questions").update({ question: "Bypass" }).eq("id", original[0].id);
    expect(direct.error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    const removed = await fixtures.supabase.from("event_application_questions").delete().eq("id", original[0].id);
    expect(removed.error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    const inserted = await fixtures.supabase.from("event_application_questions").insert({ event_id: created.id, question: team.question, response_type: team.response_type });
    expect(inserted.error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    expect(await questionsOf(fixtures, created.id)).toEqual(original);
  }));

  it("retains the first-submission lock after the application is removed", () => withFixtures(async fixtures => {
    const created = await save(fixtures, [why]);
    const application = await apply(fixtures, created.id, "submitted", {});
    expect((await fixtures.supabase.from("event_applications").delete().eq("id", application)).error).toBeNull();
    expect((await attemptSave(fixtures, [], created.id)).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
  }));
});

it("round-trips all six supported question families with order, required states and answer settings", () => withFixtures(async fixtures => {
  const types = ["short_text", "long_text", "checkbox", "multiple_choice", "dropdown", "file_upload"] as const;
  const questions = types.map((type, index) => ({
    question: `Question ${index + 1}`, response_type: type, is_required: index % 2 === 0,
    max_char_limit: type === "short_text" || type === "long_text" ? 250 : null,
    response_options: type === "checkbox" || type === "multiple_choice" || type === "dropdown" ? ["A", "B"] : null,
    description: "Retained instructions",
  }));
  const created = await save(fixtures, questions);
  const rows = await questionsOf(fixtures, created.id);
  expect(rows.map(q => ({ question: q.question, response_type: q.response_type, is_required: q.is_required, max_char_limit: q.max_char_limit, response_options: q.response_options, description: q.description }))).toEqual(questions);
  const reversed = [...rows].reverse().map((q, index) => ({ ...q, sort_order: index }));
  expect((await save(fixtures, reversed, created.id)).question_ids).toEqual([...created.question_ids].reverse());
  expect((await questionsOf(fixtures, created.id)).map(q => q.id)).toEqual([...created.question_ids].reverse());
}));
