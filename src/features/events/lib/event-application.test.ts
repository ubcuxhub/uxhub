import { describe, expect, it } from "vitest";
import { prepareResponseData } from "./event-application";

describe("prepareResponseData", () => {
  it("maps text and multi-select answers to database rows", () => {
    expect(
      prepareResponseData(
        [{ id: "q1" }, { id: "q2" }, { id: "q3" }],
        {
          question_0: "A response",
          question_1: ["Research", "Design"],
        },
        "application-1"
      )
    ).toEqual([
      {
        event_application_question_id: "q1",
        application_id: "application-1",
        response: "A response",
      },
      {
        event_application_question_id: "q2",
        application_id: "application-1",
        response: "Research, Design",
      },
      {
        event_application_question_id: "q3",
        application_id: "application-1",
        response: "",
      },
    ]);
  });

  it("requires an application id", () => {
    expect(() => prepareResponseData([], {}, "")).toThrow(
      "Application ID is required"
    );
  });
});
