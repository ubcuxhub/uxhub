import { describe, expect, it } from "vitest";
import { prepareResponseData } from "./eventApplication";

describe("prepareResponseData", () => {
  it("maps text and multi-select answers to database rows", () => {
    expect(
      prepareResponseData(
        [{ id: "q1" }, { id: "q2" }, { id: "q3" }],
        {
          question_0: "A response",
          question_1: ["Research", "Design"],
        },
        "registration-1"
      )
    ).toEqual([
      {
        event_application_question_id: "q1",
        event_registration_id: "registration-1",
        response: "A response",
      },
      {
        event_application_question_id: "q2",
        event_registration_id: "registration-1",
        response: "Research, Design",
      },
      {
        event_application_question_id: "q3",
        event_registration_id: "registration-1",
        response: "",
      },
    ]);
  });

  it("requires a registration id", () => {
    expect(() => prepareResponseData([], {}, "")).toThrow(
      "Registration ID is required"
    );
  });
});
