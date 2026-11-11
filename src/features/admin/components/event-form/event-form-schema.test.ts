import { teamSettingsProblem, applicationTimingProblem } from "./event-form-schema";
import { describe, expect, it } from "vitest";
import {
  createFormSnapshot,
  defaultFormState,
  isDateTimeRangeInvalid,
  isEventScheduleRangeInvalid,
  toApplicationQuestionInputs,
  toCheckInSessionInputs,
  validateEventForm,
  withSavedCheckInSessionIds,
  withSavedQuestionIds,
} from "./event-form-schema";
import type { ApplicationQuestionTemplate } from "@/features/events/types";

const validFormState = {
  ...defaultFormState,
  name: "Event",
  short_description: "Preview",
  description: "Description",
  regular_price: "0",
  member_price: "0",
  max_capacity: "10",
  starts_at: "2099-08-01T10:00",
  ends_at: "2099-08-01T11:00",
};

describe("event form schema", () => {
  it("retains zero capacity as a valid whole-number setting before seats are committed", () => {
    expect(validateEventForm({ ...validFormState, max_capacity: "0" }, [], []).error).toBeNull();
  });
  it.each([
    ["starts_at", ""],
    ["starts_at", "2099-08-01T"],
    ["starts_at", "T10:00"],
    ["ends_at", ""],
    ["ends_at", "2099-08-01T"],
    ["ends_at", "T11:00"],
  ])("requires a complete %s, not %j", (field, value) => {
    expect(validateEventForm({ ...validFormState, [field]: value }, [], []).error)
      .toBe("Event start and end dates and times are required.");
  });

  it.each(["2099-08-01T", "T10:00"])("rejects incomplete registration date/time %s", (value) => {
    expect(validateEventForm({ ...validFormState, registration_opens_at: value }, [], []).error)
      .toBe("Registration dates require both a date and time.");
  });
  it.each([
    ["", null],
    ["2099-08-01T10:00", null],
    ["2020-08-01T10:00", "Publish date must be in the future."],
    ["invalid", "Publish date must be a valid date and time in Pacific time."],
    ["2099-08-01T", "Publish date must be a valid date and time in Pacific time."],
    ["T10:00", "Publish date must be a valid date and time in Pacific time."],
    ["2024-03-10T02:30", "Publish date must be a valid date and time in Pacific time."],
  ])("validates the Pacific publish time %s", (publish_at, expected) => {
    const result = validateEventForm({
      ...validFormState,
      name: "Event",
      short_description: "Preview",
      description: "Description",
      regular_price: "0",
      member_price: "0",
      max_capacity: "10",
      publish_at,
    }, [], []);
    expect(result.error).toBe(expected);
  });

  it("detects invalid time ranges", () => {
    expect(isDateTimeRangeInvalid("2026-08-01T10:00", "2026-08-01T09:00")).toBe(
      true
    );
    expect(isDateTimeRangeInvalid("2026-08-01T10:00", "")).toBe(false);
  });

  it("detects invalid event schedules", () => {
    expect(
      isEventScheduleRangeInvalid({
        ...validFormState,
        starts_at: "2026-08-02T10:00",
        ends_at: "2026-08-01T10:00",
      })
    ).toBe(true);
  });

  it("returns question-specific validation errors", () => {
    const result = validateEventForm(
      {
        ...validFormState,
        name: "Event",
        short_description: "Preview",
        description: "Description",
        regular_price: "10",
        member_price: "5",
        max_capacity: "100",
      },
      [{ name: "Doors", start_time: "2026-08-01T09:00", end_time: "2026-08-01T10:00" }],
      [
        {
          question: "",
          description: "",
          response: "long_text",
          is_required: false,
          max_char_limit: "",
          response_options: [],
        },
      ]
    );
    expect(result.error).toContain("application questions");
    expect(result.questionErrors[0]).toBe("Question is required.");
    expect(result.invalidSections.applications).toBe(true);
  });

  it("validates mentor and sponsor drafts while their sections are disabled", () => {
    const result = validateEventForm(
      {
        ...defaultFormState,
        name: "Event",
        short_description: "Preview",
        description: "Description",
        regular_price: "10",
        member_price: "5",
        max_capacity: "100",
      },
      [
        {
          name: "Doors",
          start_time: "2026-08-01T09:00",
          end_time: "2026-08-01T10:00",
        },
      ],
      [],
      [
        {
          full_name: " ",
          position: "",
          linkedin_url: "",
          description: "",
          profile_image_path: "",
        },
      ],
      [{ name: "", brand_logo_path: "" }]
    );

    expect(result.error).toBe("Every mentor requires a full name.");
    expect(result.invalidSections.mentors).toBe(true);
    expect(result.invalidSections.sponsors).toBe(true);
  });

  it("tracks links and unfinished person-card edits in the working document", () => {
    const mentor = {
      id: "mentor-1",
      full_name: "Mentor",
      position: "",
      linkedin_url: "",
      description: "",
      profile_image_path: "",
    };
    const initial = createFormSnapshot(
      defaultFormState,
      [],
      [mentor],
      [],
      []
    );
    const edited = createFormSnapshot(
      defaultFormState,
      [],
      [{ ...mentor, full_name: "Updated Mentor", isEditing: true }],
      [],
      []
    );
    const relinked = createFormSnapshot(
      defaultFormState,
      [],
      [{ ...mentor, id: "mentor-2" }],
      [],
      []
    );

    expect(edited).not.toBe(initial);
    expect(relinked).not.toBe(initial);
  });
});

describe("application question payload", () => {
  const question = (
    overrides: Partial<ApplicationQuestionTemplate>
  ): ApplicationQuestionTemplate => ({
    question: "Why?",
    description: "",
    response: "long_text",
    is_required: true,
    max_char_limit: "",
    response_options: [],
    ...overrides,
  });

  it("sends saved questions with their ids and new ones with null", () => {
    const inputs = toApplicationQuestionInputs([
      question({ id: "question-1" }),
      question({ question: "New" }),
    ]);

    expect(inputs.map(({ id, sort_order }) => ({ id, sort_order }))).toEqual([
      { id: "question-1", sort_order: 0 },
      { id: null, sort_order: 1 },
    ]);
  });

  it("gives file questions the bucket's rule: one PDF, at most 5 MB", () => {
    const [file] = toApplicationQuestionInputs([
      question({ response: "file_upload", max_char_limit: 300 }),
    ]);

    expect(file).toMatchObject({
      response_type: "file_upload",
      restrict_file_types: true,
      allowed_file_types: ["pdf"],
      max_file_size_bytes: 5 * 1024 * 1024,
      max_char_limit: null,
      response_options: null,
    });
  });

  it("keeps type-specific settings to the types they apply to", () => {
    const [text, choice] = toApplicationQuestionInputs([
      question({ response: "short_text", max_char_limit: "" }),
      question({
        response: "dropdown",
        max_char_limit: 300,
        response_options: ["A", "B"],
      }),
    ]);

    expect(text).toMatchObject({
      max_char_limit: null,
      response_options: null,
      restrict_file_types: false,
      allowed_file_types: null,
      max_file_size_bytes: null,
    });
    expect(choice).toMatchObject({
      max_char_limit: null,
      response_options: ["A", "B"],
    });
  });

  it("accepts a file question with no file settings to fill in", () => {
    const result = validateEventForm(validFormState, [], [
      question({ response: "file_upload", is_required: false }),
    ]);

    expect(result.questionErrors).toEqual({});
    expect(result.error).toBeNull();
  });

  it("adopts the ids a save returns, in the order it was sent", () => {
    const saved = withSavedQuestionIds(
      [question({ id: "question-1" }), question({ question: "New" })],
      ["question-1", "question-2"]
    );

    expect(saved.map((item) => item.id)).toEqual(["question-1", "question-2"]);
    expect(
      withSavedQuestionIds([question({ id: "question-1" })], [])[0].id
    ).toBe("question-1");
  });
});

describe("event form check-in sessions", () => {
  it("sends each session's id, or null for a new one, with its times in UTC", () => {
    expect(
      toCheckInSessionInputs([
        {
          id: "session-1",
          name: "Doors",
          start_time: "2024-08-01T10:00",
          end_time: "2024-08-01T11:00",
        },
        { name: "Lunch", start_time: "2024-08-01T12:00", end_time: "2024-08-01T13:00" },
      ])
    ).toEqual([
      {
        id: "session-1",
        name: "Doors",
        start_time: "2024-08-01T17:00:00.000Z",
        end_time: "2024-08-01T18:00:00.000Z",
      },
      {
        id: null,
        name: "Lunch",
        start_time: "2024-08-01T19:00:00.000Z",
        end_time: "2024-08-01T20:00:00.000Z",
      },
    ]);
  });

  it("adopts the ids a save returns, in the order it was sent", () => {
    const session = { name: "Doors", start_time: "", end_time: "" };
    const saved = withSavedCheckInSessionIds(
      [{ ...session, id: "session-1" }, { ...session, name: "Lunch" }],
      ["session-1", "session-2"]
    );

    expect(saved.map((item) => item.id)).toEqual(["session-1", "session-2"]);
    expect(
      withSavedCheckInSessionIds([{ ...session, id: "session-1" }], [])[0].id
    ).toBe("session-1");
  });
});


describe("application timing", () => {
  it("keeps both moments optional and permits elapsed values", () => {
    expect(applicationTimingProblem({ decisions_release_at: "", confirmation_deadline: "" })).toBeNull();
    expect(applicationTimingProblem({ decisions_release_at: "2020-01-01T09:00", confirmation_deadline: "" })).toBeNull();
  });
  it.each(["2099-01-01T", "T09:00", "2026-03-08T02:30", "2025-11-02T01:30"])("rejects incomplete or ambiguous Pacific moment %s", value => {
    expect(applicationTimingProblem({ decisions_release_at: value, confirmation_deadline: "" })).toMatch(/valid, unambiguous/);
  });
  it("requires confirmation after release, including across the DST boundary", () => {
    expect(applicationTimingProblem({ decisions_release_at: "2025-11-02T00:30", confirmation_deadline: "2025-11-02T02:00" })).toBeNull();
    expect(applicationTimingProblem({ decisions_release_at: "2099-01-01T09:00", confirmation_deadline: "2099-01-01T09:00" })).toMatch(/later/);
  });
  it("requires a question for Application mode", () => {
    expect(validateEventForm({ ...validFormState, requires_application: true }, [], []).questionErrors[-1]).toMatch(/at least one valid question/);
  });
});


describe("team form settings", () => {
  it.each(["0", "-1", "1.5", "1e2", "no", "2147483648"])("rejects an invalid size %s even when teams are off", value => {
    expect(teamSettingsProblem({ ...defaultFormState, min_team_size: value })).toMatch(/positive whole number/);
    expect(teamSettingsProblem({ ...defaultFormState, max_team_size: value })).toMatch(/positive whole number/);
  });
  it("accepts blank limits and elapsed deadlines without event-relative ordering", () => {
    expect(teamSettingsProblem(defaultFormState)).toBeNull();
    expect(teamSettingsProblem({ ...defaultFormState, min_team_size: "1", max_team_size: "4", team_deadline: "2020-01-01T10:00" })).toBeNull();
  });
  it("rejects reversed limits and incomplete, invalid or ambiguous Pacific deadlines", () => {
    expect(teamSettingsProblem({ ...defaultFormState, min_team_size: "5", max_team_size: "4" })).toMatch(/cannot exceed/);
    for (const deadline of ["2026-11-16T", "T10:00", "2026-02-30T10:00", "2026-03-08T02:30", "2025-11-02T01:30"]) expect(teamSettingsProblem({ ...defaultFormState, team_deadline: deadline })).toMatch(/valid, unambiguous/);
    expect(validateEventForm({ ...validFormState, min_team_size: "5", max_team_size: "4" }, [], []).error).toMatch(/cannot exceed/);
  });
});

describe("publication issue collection", () => {
  it.each(["disabled", "hosted", "external"] as const)("requires a long overview only with enabled marketing (%s)", marketing_mode => {
    const state = { ...validFormState, marketing_mode, marketing_url: "https://example.com/event", description: "" };
    const result = validateEventForm(state, [], []);
    expect(result.issues.some(issue => issue.target === "long-overview")).toBe(marketing_mode !== "disabled");
    expect(validateEventForm({ ...state, short_description: "" }, [], []).issues.some(issue => issue.target === "short-overview")).toBe(true);
  });
  it("collects issues across all sections and distinguishes missing values from consistency errors", () => {
    const state = { ...validFormState, name: "", description: "", max_capacity: "-1", registration_opens_at: "2099-08-02T12:00", registration_closes_at: "2099-08-01T12:00", min_team_size: "3", max_team_size: "2" };
    const issues = validateEventForm(state, [], []).issues;
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "basics", target: "event-name", required: true }),
      expect.objectContaining({ section: "description", target: "long-overview", required: true }),
      expect.objectContaining({ section: "registration", target: "event-capacity", required: false }),
      expect.objectContaining({ section: "registration", target: "registration_closes_at-date", required: false }),
      expect.objectContaining({ section: "teams", required: false }),
    ]));
    expect(validateEventForm(validFormState, [], []).issues).toEqual([]);
  });
  it("does not count optional sections and rejects publication at or after registration closes", () => {
    expect(validateEventForm({ ...validFormState, max_capacity: "0", marketing_mode: "disabled", description: "" }, [], []).issues).toEqual([]);
    const result = validateEventForm({ ...validFormState, publish_at: "2099-08-01T10:00", registration_closes_at: "2099-08-01T10:00" }, [], []);
    expect(result.issues).toContainEqual(expect.objectContaining({ section: "summary", message: "Publish time must be before registration closes." }));
  });
});
