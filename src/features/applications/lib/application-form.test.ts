import { describe, expect, it } from "vitest";

import {
  answersFromResponses,
  applicationWindow,
  encodeAnswer,
  formatYearLevel,
  isAnswered,
  isOwnFilePath,
  parseAnswers,
  unansweredRequiredIds,
  validateAnswer,
  validateAnswers,
  type ApplicationQuestion,
} from "./application-form";

function question(overrides: Partial<ApplicationQuestion> & Pick<ApplicationQuestion, "id" | "response_type">): ApplicationQuestion {
  return {
    question: `Question ${overrides.id}`,
    description: null,
    is_required: true,
    max_char_limit: null,
    response_options: null,
    ...overrides,
  };
}

const why = question({ id: "why", response_type: "long_text", max_char_limit: 10 });
const link = question({ id: "link", response_type: "short_text", is_required: false });
const year = question({ id: "year", response_type: "multiple_choice", response_options: ["1", "2"] });
const roles = question({
  id: "roles",
  response_type: "checkbox",
  response_options: ["Research", "Design, UI"],
});
const session = question({ id: "session", response_type: "dropdown", response_options: ["Sat", "Sun"] });
const resume = question({ id: "resume", response_type: "file_upload" });
const questions = [why, link, year, roles, session, resume];

describe("answersFromResponses", () => {
  it("fills every question, decoding checkbox answers and defaulting the rest", () => {
    expect(
      answersFromResponses(questions, [
        { event_application_question_id: "why", response: "Because" },
        { event_application_question_id: "roles", response: '["Design, UI"]' },
        { event_application_question_id: "unknown", response: "ignored" },
      ])
    ).toEqual({
      why: "Because",
      link: "",
      year: "",
      roles: ["Design, UI"],
      session: "",
      resume: "",
    });
  });

  it("reads a legacy comma-joined checkbox answer by its option labels", () => {
    expect(
      answersFromResponses([roles], [
        { event_application_question_id: "roles", response: "Research, Design, UI" },
      ]).roles
    ).toEqual(["Research", "Design, UI"]);
  });
});

describe("encodeAnswer and isAnswered", () => {
  it("stores checkbox answers as JSON and text as itself", () => {
    expect(encodeAnswer(roles, ["Design, UI"])).toBe('["Design, UI"]');
    expect(encodeAnswer(roles, "oops")).toBe("[]");
    expect(encodeAnswer(why, "Hi")).toBe("Hi");
    expect(encodeAnswer(why, undefined)).toBe("");
  });

  it("treats blank text and empty selections as unanswered", () => {
    expect(isAnswered(why, "   ")).toBe(false);
    expect(isAnswered(roles, [])).toBe(false);
    expect(isAnswered(roles, ["Research"])).toBe(true);
  });
});

describe("validateAnswer", () => {
  it("lets a draft leave required questions empty but not submit them", () => {
    expect(validateAnswer(why, "", "draft")).toBeNull();
    expect(validateAnswer(why, "", "submit")).toBe("Enter an answer.");
    expect(validateAnswer(year, "", "submit")).toBe("Choose an answer.");
    expect(validateAnswer(session, "", "submit")).toBe("Choose an answer.");
    expect(validateAnswer(roles, [], "submit")).toBe("Choose at least one option.");
    expect(validateAnswer(resume, "", "submit")).toBe("Upload a file.");
    expect(validateAnswer(link, "", "submit")).toBeNull();
  });

  it("holds text to its character limit, counting characters not bytes", () => {
    expect(validateAnswer(why, "é".repeat(10), "draft")).toBeNull();
    expect(validateAnswer(why, "x".repeat(11), "draft")).toBe(
      "Keep your answer to 10 characters or fewer."
    );
  });

  it("accepts only listed options", () => {
    expect(validateAnswer(year, "3", "draft")).toBe("Choose one of the listed options.");
    expect(validateAnswer(session, "Sun", "submit")).toBeNull();
    expect(validateAnswer(roles, ["Research", "Other"], "draft")).toBe(
      "Choose from the listed options."
    );
    expect(validateAnswer(roles, ["Research", "Research"], "draft")).toBe(
      "Choose each option once."
    );
  });

  it("rejects an answer of the wrong shape", () => {
    expect(validateAnswer(why, ["a"], "draft")).toBe("Enter a valid answer.");
    expect(validateAnswer(roles, "Research", "draft")).toBe("Choose from the listed options.");
  });
});

describe("validateAnswers and unansweredRequiredIds", () => {
  it("lists problems in question order", () => {
    const answers = { why: "x".repeat(11), link: "", year: "", roles: [], session: "Sat", resume: "" };
    expect(Object.keys(validateAnswers(questions, answers, "submit"))).toEqual([
      "why",
      "year",
      "roles",
      "resume",
    ]);
    expect(unansweredRequiredIds(questions, answers)).toEqual(["year", "roles", "resume"]);
  });
});

describe("parseAnswers", () => {
  it("keeps answers to known questions and drops other keys", () => {
    expect(parseAnswers(questions, { why: "Hi", roles: ["Research"], other: "x" })).toEqual({
      why: "Hi",
      roles: ["Research"],
    });
  });

  it("refuses anything that is not answers", () => {
    expect(parseAnswers(questions, null)).toBeNull();
    expect(parseAnswers(questions, ["why"])).toBeNull();
    expect(parseAnswers(questions, { why: 3 })).toBeNull();
    expect(parseAnswers(questions, { roles: [1] })).toBeNull();
  });
});

describe("applicationWindow", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");

  it("is open inside the window, and when a bound is missing", () => {
    expect(
      applicationWindow(
        { registration_opens_at: "2026-11-01T00:00:00Z", registration_closes_at: "2026-11-30T00:00:00Z" },
        now
      )
    ).toBe("open");
    expect(applicationWindow({ registration_opens_at: null, registration_closes_at: null }, now)).toBe(
      "open"
    );
  });

  it("is not open before it opens and closed after it closes", () => {
    expect(
      applicationWindow({ registration_opens_at: "2026-11-07T00:00:00Z", registration_closes_at: null }, now)
    ).toBe("not_open");
    expect(
      applicationWindow({ registration_opens_at: null, registration_closes_at: "2026-11-06T11:59:59Z" }, now)
    ).toBe("closed");
  });
});

describe("isOwnFilePath", () => {
  const owner = { userInfoId: "u", applicationId: "a", questionId: "q" };

  it("accepts a file directly under the applicant's question folder", () => {
    expect(isOwnFilePath("u/a/q/resume.pdf", owner)).toBe(true);
  });

  it("refuses another folder, a nested path, or the folder itself", () => {
    expect(isOwnFilePath("x/a/q/resume.pdf", owner)).toBe(false);
    expect(isOwnFilePath("u/a/other/resume.pdf", owner)).toBe(false);
    expect(isOwnFilePath("u/a/q/sub/resume.pdf", owner)).toBe(false);
    expect(isOwnFilePath("u/a/q/", owner)).toBe(false);
  });
});

describe("formatYearLevel", () => {
  it("names the profile's year", () => {
    expect(formatYearLevel("3")).toBe("3rd year");
    expect(formatYearLevel("5+")).toBe("5th year or later");
    expect(formatYearLevel(null)).toBe("Not set");
  });
});
