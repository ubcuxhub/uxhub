import { describe, expect, it } from "vitest";
import { changeResourceType, legacyEventContent, emptyContent, emptyContentEntry, eventContentProblem, parseEventContent, RESOURCE_DEFAULTS, safeContentUrl, type EventContent, type ResourceLink } from "./event-content";
const content = (): EventContent => ({ ...emptyContent(), sections: [{ key: crypto.randomUUID(), kind: "Judges", title: "Judges", items: [{ ...emptyContentEntry(), name: "Alex Chen" }] }] });
describe("event content boundaries", () => {
  it("requires an item even for working drafts, while optional content may be absent", () => {
    const doc = content(); doc.sections[0].items = [];
    expect(eventContentProblem(doc, true)).toContain("at least one item");
    expect(eventContentProblem(emptyContent())).toBeNull();
  });
  it("permits incomplete entry names in working documents but validates applied saves", () => {
    const doc = content(); doc.sections[0].items[0].name = "";
    expect(eventContentProblem(doc, true)).toBeNull(); expect(eventContentProblem(doc)).toContain("name");
  });
  it("preserves order, identities and new fields through serialization", () => {
    const doc = content(); doc.sections.push({ key: crypto.randomUUID(), kind: "custom", title: "Alumni", items: [{ ...emptyContentEntry(), name: "Sam", description: "Alumnus", url: "https://example.test/sam" }] });
    expect(parseEventContent(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });
  it("rejects duplicate names, reserved custom names and repeated directory records", () => {
    const doc = content(); doc.sections.push({ ...doc.sections[0], key: crypto.randomUUID(), items: [{ ...emptyContentEntry(), name: "B" }] });
    expect(eventContentProblem(doc)).toContain("unique");
    doc.sections[1] = { ...doc.sections[1], kind: "custom", title: "sponsors" };
    expect(eventContentProblem(doc)).toContain("predefined");
    doc.sections.pop(); const id = crypto.randomUUID(); doc.sections[0].items = [{ ...emptyContentEntry(), name: "A", directory_id: id }, { ...emptyContentEntry(), name: "B", directory_id: id }];
    expect(eventContentProblem(doc)).toContain("once per section");
  });
  it.each(["javascript:alert(1)", "//example.test", "https://user:password@example.test", "https://", "https://example.test\\@evil.test", "https://example.test/a b", "data:image/png;base64,x"])("rejects unsafe URL %s", url => expect(safeContentUrl(url)).toBe(false));
  it.each(["https://example.test/path?q=a#b", "http://localhost:8000/", "https://example.test/?email=a@b.test"])("allows HTTP(S) URL %s", url => expect(safeContentUrl(url)).toBe(true));
  it("retains explicit labels and audiences, and never broadens restricted defaults", () => {
    const slack: ResourceLink = { id: crypto.randomUUID(), type: "slack_workspace", url: "", ...RESOURCE_DEFAULTS.slack_workspace };
    expect(changeResourceType(slack, "participant_package")).toMatchObject({ label: "Participant package", visibility: "going" });
    expect(changeResourceType({ ...slack, label: "Custom", label_edited: true, audience_edited: true }, "participant_package")).toMatchObject({ label: "Custom", visibility: "everyone" });
    expect(changeResourceType({ ...slack, type: "participant_package", visibility: "going" }, "slack_workspace").visibility).toBe("going");
  });
});


it("restores old mentor/sponsor draft edits without dropping other stored groups or links", () => {
  const source = content(); source.revision = 3;
  const restored = legacyEventContent([{ full_name: "Draft mentor", position: "", description: "", linkedin_url: "", profile_image_path: "" }], [], source);
  expect(restored.revision).toBe(3);
  expect(restored.sections.map(section => section.kind)).toEqual(["Judges", "Mentors"]);
  expect(restored.sections[1].items[0].name).toBe("Draft mentor");
});
