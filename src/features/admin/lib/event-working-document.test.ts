import { describe, expect, it } from "vitest";
import { defaultFormState } from "../components/event-form/event-form-schema";
import { parseWorkingDocument } from "./event-working-document";
const document = { version: 1, formState: defaultFormState, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
describe("working document boundary", () => {
  it("accepts an empty incomplete draft without public event defaults", () => expect(parseWorkingDocument(document).formState.name).toBe(""));
  it("preserves incomplete section values and unfinished cards", () => {
    const incomplete = { ...document, checkInEvents: [{ name: "Doors", start_time: "", end_time: "" }], sponsors: [{ name: "Unfinished", brand_logo_path: "", isEditing: true }] };
    expect(parseWorkingDocument(JSON.parse(JSON.stringify(incomplete)))).toEqual(incomplete);
  });
  it.each([{ ...document, checkInEvents: [{}] }, { ...document, formState: { ...defaultFormState, name: 5 } }, { ...document, formState: { ...defaultFormState, image_url: "data:local-file" } }, { ...document, formState: { ...defaultFormState, short_description: "x".repeat(51) } }])("rejects malformed fields or unsaved file previews", value => expect(() => parseWorkingDocument(value)).toThrow());
});
