import {
  decodeCheckboxResponse,
  encodeCheckboxResponse,
  hasApplicationAnswer,
} from "@/lib/application-response";
import type { EventApplicationQuestionRow, EventRow } from "@/lib/supabase/models";

/**
 * The application form's answers and their rules, shared by the form (errors
 * after Submit) and the server actions (which trust nothing the browser sends).
 * `submit_event_application` applies the same "missing" rule again when it
 * submits; this is what lets the form say which questions to fix first.
 */

export type ApplicationQuestion = Pick<
  EventApplicationQuestionRow,
  | "id"
  | "question"
  | "description"
  | "response_type"
  | "is_required"
  | "max_char_limit"
  | "response_options"
>;

/** A checkbox answer is the chosen labels; every other answer is text. */
export type AnswerValue = string | string[];

/** Answers keyed by question id. */
export type ApplicationAnswers = Record<string, AnswerValue>;

/** Error messages keyed by question id, in question order. */
export type AnswerErrors = Record<string, string>;

/**
 * `draft` checks only what may be saved (options and limits); `submit` also
 * needs every required question answered.
 */
export type ValidationMode = "draft" | "submit";

export function emptyAnswer(question: Pick<ApplicationQuestion, "response_type">): AnswerValue {
  return question.response_type === "checkbox" ? [] : "";
}

/** The form's starting answers: what is saved, else empty. */
export function answersFromResponses(
  questions: readonly ApplicationQuestion[],
  responses: readonly { event_application_question_id: string; response: string }[]
): ApplicationAnswers {
  const saved = new Map(
    responses.map((row) => [row.event_application_question_id, row.response])
  );
  return Object.fromEntries(
    questions.map((question) => {
      const response = saved.get(question.id);
      if (response === undefined) return [question.id, emptyAnswer(question)];
      return [
        question.id,
        question.response_type === "checkbox"
          ? decodeCheckboxResponse(response, question.response_options)
          : response,
      ];
    })
  );
}

/** How an answer is stored in `event_application_responses.response`. */
export function encodeAnswer(
  question: Pick<ApplicationQuestion, "response_type">,
  value: AnswerValue | undefined
): string {
  if (question.response_type === "checkbox") {
    return encodeCheckboxResponse(Array.isArray(value) ? value : []);
  }
  return typeof value === "string" ? value : "";
}

export function isAnswered(
  question: Pick<ApplicationQuestion, "response_type">,
  value: AnswerValue | undefined
): boolean {
  return hasApplicationAnswer(question.response_type, encodeAnswer(question, value));
}

/** Characters as Postgres's `char_length` counts them. */
export function characterCount(text: string): number {
  return [...text].length;
}

const REQUIRED_MESSAGE: Record<string, string> = {
  multiple_choice: "Choose an answer.",
  dropdown: "Choose an answer.",
  checkbox: "Choose at least one option.",
  file_upload: "Upload a file.",
};

/** Why an answer can't be saved or submitted, or null when it can. */
export function validateAnswer(
  question: ApplicationQuestion,
  value: AnswerValue | undefined,
  mode: ValidationMode
): string | null {
  const options = question.response_options ?? [];

  if (question.response_type === "checkbox") {
    if (value !== undefined && !isStringArray(value)) return "Choose from the listed options.";
    const chosen = value ?? [];
    if (chosen.some((option) => !options.includes(option))) {
      return "Choose from the listed options.";
    }
    if (new Set(chosen).size !== chosen.length) return "Choose each option once.";
  } else {
    if (value !== undefined && typeof value !== "string") return "Enter a valid answer.";
    const text = value ?? "";
    if (
      (question.response_type === "multiple_choice" ||
        question.response_type === "dropdown") &&
      text !== "" &&
      !options.includes(text)
    ) {
      return "Choose one of the listed options.";
    }
    if (
      (question.response_type === "short_text" ||
        question.response_type === "long_text") &&
      question.max_char_limit &&
      characterCount(text) > question.max_char_limit
    ) {
      return `Keep your answer to ${question.max_char_limit} characters or fewer.`;
    }
  }

  if (mode === "submit" && question.is_required && !isAnswered(question, value)) {
    return REQUIRED_MESSAGE[question.response_type] ?? "Enter an answer.";
  }
  return null;
}

/** Every question's error, in question order; empty when all are fine. */
export function validateAnswers(
  questions: readonly ApplicationQuestion[],
  answers: ApplicationAnswers,
  mode: ValidationMode
): AnswerErrors {
  const errors: AnswerErrors = {};
  for (const question of questions) {
    const message = validateAnswer(question, answers[question.id], mode);
    if (message) errors[question.id] = message;
  }
  return errors;
}

/**
 * Reads answers sent by the browser: an object keyed by question id. Keys
 * that name none of `questions` are dropped. Returns null for anything else.
 */
export function parseAnswers(
  questions: readonly ApplicationQuestion[],
  input: unknown
): ApplicationAnswers | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const answers: ApplicationAnswers = {};
  for (const question of questions) {
    if (!Object.hasOwn(record, question.id)) continue;
    const value = record[question.id];
    if (typeof value === "string" || isStringArray(value)) {
      answers[question.id] = value;
    } else {
      return null;
    }
  }
  return answers;
}

/** Required questions still unanswered, in question order. */
export function unansweredRequiredIds(
  questions: readonly ApplicationQuestion[],
  answers: ApplicationAnswers
): string[] {
  return questions
    .filter((question) => question.is_required && !isAnswered(question, answers[question.id]))
    .map((question) => question.id);
}

export type ApplicationWindow = "not_open" | "open" | "closed";

/** Mirrors submit_event_application's window check. */
export function applicationWindow(
  event: Pick<EventRow, "registration_opens_at" | "registration_closes_at">,
  now = Date.now()
): ApplicationWindow {
  if (event.registration_opens_at && now < Date.parse(event.registration_opens_at)) {
    return "not_open";
  }
  if (event.registration_closes_at && now > Date.parse(event.registration_closes_at)) {
    return "closed";
  }
  return "open";
}

/**
 * Whether a file answer names an upload of this applicant's for this question:
 * `<user_info_id>/<application_id>/<question_id>/<file>`.
 */
export function isOwnFilePath(
  path: string,
  owner: { userInfoId: string; applicationId: string; questionId: string }
): boolean {
  const prefix = `${owner.userInfoId}/${owner.applicationId}/${owner.questionId}/`;
  const name = path.slice(prefix.length);
  return path.startsWith(prefix) && name.length > 0 && !name.includes("/");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const YEAR_LEVELS: Record<string, string> = {
  "1": "1st year",
  "2": "2nd year",
  "3": "3rd year",
  "4": "4th year",
  "5+": "5th year or later",
};

/** "3rd year" for a profile's `year`; "Not set" when it is empty. */
export function formatYearLevel(year: string | null | undefined): string {
  if (!year) return "Not set";
  return YEAR_LEVELS[year] ?? year;
}
