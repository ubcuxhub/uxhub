import { describe, expect, it } from "vitest";

import {
  applicationFileName,
  decodeCheckboxResponse,
  encodeCheckboxResponse,
  hasApplicationAnswer,
} from "./application-response";

describe("checkbox responses", () => {
  it("round-trips options that contain commas", () => {
    const values = ["Research", "Design, UI", 'Say "hi"'];
    const stored = encodeCheckboxResponse(values);

    expect(stored).toBe('["Research","Design, UI","Say \\"hi\\""]');
    expect(decodeCheckboxResponse(stored)).toEqual(values);
  });

  it("reads an empty selection as no answer", () => {
    expect(decodeCheckboxResponse(encodeCheckboxResponse([]))).toEqual([]);
    expect(decodeCheckboxResponse("")).toEqual([]);
    expect(decodeCheckboxResponse(null)).toEqual([]);
  });

  it("reads legacy comma-joined answers", () => {
    expect(decodeCheckboxResponse("User research, Prototyping")).toEqual([
      "User research",
      "Prototyping",
    ]);
    expect(decodeCheckboxResponse("Vegetarian")).toEqual(["Vegetarian"]);
  });

  it("keeps a legacy option with a comma whole when the options are known", () => {
    const options = ["Research", "Design, UI", "Design"];

    expect(decodeCheckboxResponse("Research, Design, UI", options)).toEqual([
      "Research",
      "Design, UI",
    ]);
    expect(decodeCheckboxResponse("Design, Research", options)).toEqual([
      "Design",
      "Research",
    ]);
    expect(decodeCheckboxResponse("Design, Unknown", options)).toEqual([
      "Design",
      "Unknown",
    ]);
  });

  it("treats text that only looks like JSON as legacy", () => {
    expect(decodeCheckboxResponse("[Draft], Final")).toEqual(["[Draft]", "Final"]);
    expect(decodeCheckboxResponse("[1, 2]")).toEqual(["[1", "2]"]);
  });
});

describe("hasApplicationAnswer", () => {
  it("matches what submit_event_application counts as missing", () => {
    expect(hasApplicationAnswer("short_text", "  ")).toBe(false);
    expect(hasApplicationAnswer("short_text", "Hi")).toBe(true);
    expect(hasApplicationAnswer("checkbox", "[]")).toBe(false);
    expect(hasApplicationAnswer("checkbox", '["A"]')).toBe(true);
    expect(hasApplicationAnswer("file_upload", null)).toBe(false);
  });
});

describe("applicationFileName", () => {
  it("is the last segment of the object key", () => {
    expect(applicationFileName("u/a/q/Resume 2026.pdf")).toBe("Resume 2026.pdf");
    expect(applicationFileName("")).toBe("");
  });
});
