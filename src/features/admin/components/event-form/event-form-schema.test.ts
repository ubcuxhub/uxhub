import { describe, expect, it } from "vitest";
import {
  createFormSnapshot,
  defaultFormState,
  isFreePricing,
  isDateTimeRangeInvalid,
  isEventScheduleRangeInvalid,
  validateEventForm,
} from "./event-form-schema";

describe("event form schema", () => {
  it("detects invalid time ranges", () => {
    expect(isDateTimeRangeInvalid("2026-08-01T10:00", "2026-08-01T09:00")).toBe(
      true
    );
    expect(isDateTimeRangeInvalid("2026-08-01T10:00", "")).toBe(false);
  });

  it("detects invalid event schedules", () => {
    expect(
      isEventScheduleRangeInvalid({
        ...defaultFormState,
        start_date: "2026-08-02",
        start_time: "10:00",
        end_date: "2026-08-01",
        end_time: "10:00",
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
        ...defaultFormState,
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
          restrict_file_types: false,
          allowed_file_types: [],
          max_file_size_bytes: "",
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
