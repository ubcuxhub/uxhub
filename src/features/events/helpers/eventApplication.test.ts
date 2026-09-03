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
        }
      )
    ).toEqual([
      {
        question_id: "q1",
        response: "A response",
      },
      {
        question_id: "q2",
        response: "Research, Design",
      },
      {
        question_id: "q3",
        response: "",
      },
    ]);
  });
});
