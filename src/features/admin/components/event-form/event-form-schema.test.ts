import { describe, expect, it } from "vitest";
import {
  defaultFormState,
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

  it("returns question-specific validation errors", () => {
    const result = validateEventForm(
      {
        ...defaultFormState,
        name: "Event",
        description: "Description",
        regular_price: "10",
        member_price: "5",
        max_capacity: "100",
      },
      [{ name: "Doors", start_time: "2026-08-01T09:00", end_time: "2026-08-01T10:00" }],
      [{ question: "", response: "text", max_char_limit: "" }]
    );
    expect(result.error).toContain("application questions");
    expect(result.questionErrors[0]).toBe("Question is required.");
  });
});
