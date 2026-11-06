import { describe, expect, it } from "vitest";
import {
  createFormSnapshot,
  defaultFormState,
  isFreePricing,
  isDateTimeRangeInvalid,
  isEventScheduleRangeInvalid,
  toApplicationQuestionInputs,
  validateEventForm,
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

  it("recognizes free pricing only when both prices are explicitly zero", () => {
    expect(isFreePricing("0", "0")).toBe(true);
    expect(isFreePricing("", "")).toBe(false);
    expect(isFreePricing("10", "0")).toBe(false);
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

  it("tracks event-person links without tracking catalog field edits", () => {
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

    expect(edited).toBe(initial);
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
      max_char_limit: 5000,
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
