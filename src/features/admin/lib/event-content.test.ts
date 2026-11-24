import { describe, expect, it } from "vitest";
import { changeResourceType, legacyEventContent, emptyContent, emptyContentEntry, eventContentProblem, parseEventContent, RESOURCE_DEFAULTS, safeContentUrl, safeStaffScheduleUrl, restoreResourceContent, type EventContent, type ResourceLink } from "./event-content";
const content = (): EventContent => ({ ...emptyContent(), sections: [{ key: crypto.randomUUID(), kind: "Judges", title: "Judges", items: [{ ...emptyContentEntry(), name: "Alex Chen" }] }] });
describe("event content boundaries", () => {
  it("preserves unfinished empty sections but requires an item for publication", () => {
    const doc = content(); doc.sections[0].items = [];
    expect(eventContentProblem(doc, true)).toBeNull();
    expect(eventContentProblem(doc)).toContain("at least one item");
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

const staffLink = (url = "https://example.test/schedule"): ResourceLink => ({ id: crypto.randomUUID(), type: "volunteer_schedule", visibility: "staff", url, label: "Volunteer Schedule" });
describe("Volunteer Schedule validation", () => {
  it.each(["https://example.test/schedule?q=a#b", "https://localhost:443/", "HTTPS://example.test", "https://[::1]/"])("allows safe HTTPS %s", url => {
    expect(safeStaffScheduleUrl(url)).toBe(true);
    expect(eventContentProblem({ ...emptyContent(), links: [staffLink(url)] }, true)).toBeNull();
  });
  it.each(["http://example.test", "/schedule", "//example.test", "javascript:alert(1)", "data:text/plain,x", "https://", "https://user:pass@example.test", "https://example.test:invalid", "https://example.test:99999", "https://[:::]", "https://999.999.999.999", "https://example.test/a b", "https://example.test\\evil"])("rejects unsafe staff URL %s in drafts and applied saves", url => {
    expect(safeStaffScheduleUrl(url)).toBe(false);
    expect(eventContentProblem({ ...emptyContent(), links: [staffLink(url)] }, true)).toContain("HTTPS");
    expect(eventContentProblem({ ...emptyContent(), links: [staffLink(url)] })).toContain("HTTPS");
  });
  it("allows incomplete drafts, enforces a single row and rejects forged audiences", () => {
    expect(eventContentProblem({ ...emptyContent(), links: [staffLink("")] }, true)).toBeNull();
    expect(eventContentProblem({ ...emptyContent(), links: [staffLink("")] })).toContain("URL");
    expect(() => parseEventContent({ ...emptyContent(), links: [staffLink(), staffLink()] })).toThrow(/one Volunteer/);
    for (const visibility of ["everyone", "going", "after_event"]) expect(() => parseEventContent({ ...emptyContent(), links: [{ ...staffLink(), visibility }] })).toThrow(/only to UX Hub execs/);
  });
  it("forces staff access on type changes and restores normal defaults on conversion back", () => {
    const ordinary = { ...staffLink(), type: "other" as const, visibility: "everyone" as const, audience_edited: true };
    const schedule = changeResourceType(ordinary, "volunteer_schedule");
    expect(schedule.visibility).toBe("staff");
    expect(changeResourceType(schedule, "participant_package").visibility).toBe("going");
  });
  it("recovers a saved private resource in old drafts while retaining explicit new removals", () => {
    const saved = { ...emptyContent(), links: [staffLink()] };
    const old = { revision: 0, sections: [], links: [] };
    expect(restoreResourceContent(old, saved).links).toEqual(saved.links);
    expect(restoreResourceContent(emptyContent(), saved).links).toEqual([]);
  });
});
