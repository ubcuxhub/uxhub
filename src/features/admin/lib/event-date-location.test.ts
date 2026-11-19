import { describe, expect, it } from "vitest";
import { dateLocationProblem, dateSessions, emptyLocation, parseDateLocationDraft, type EventDateLocationDraft } from "./event-date-location";

const valid = (): EventDateLocationDraft => ({ automatic: true, audience: "everyone", location: { ...emptyLocation(), building: "Nest", address: "6133 University Blvd" }, dates: [{ key: "one", session_id: null, date: "2026-11-14", start: "09:00", end: "17:00", label: "Opening", location: null }] });

describe("event date/location draft", () => {
  it("preserves partial input and inactive location types in working drafts", () => {
    const document = valid(); document.location.meeting_url = "https://"; document.dates[0].end = "";
    expect(parseDateLocationDraft(document)).toEqual(document);
    expect(dateLocationProblem(document)).toMatch(/Every date/);
    document.dates[0].end = "17:00";
    expect(dateLocationProblem(document)).toBeNull();
  });
  it("refuses executable links and malformed or duplicate identities", () => {
    const document = valid(); document.location.map_url = "javascript:alert(1)";
    expect(() => parseDateLocationDraft(document)).toThrow(/Invalid date/);
    const duplicate = valid(); duplicate.dates.push({ ...duplicate.dates[0] });
    expect(() => parseDateLocationDraft(duplicate)).toThrow(/identity/);
  });
  it("checks each whole-location override and restricted public summary", () => {
    const document = valid(); document.audience = "going";
    expect(dateLocationProblem(document)).toMatch(/public location summary/);
    document.location.public_summary = "UBC Vancouver";
    document.dates[0].location = { ...emptyLocation(), type: "online", public_summary: "Online" };
    expect(dateLocationProblem(document)).toMatch(/meeting link/);
    document.dates[0].location.meeting_url = "https://example.com/meeting";
    expect(dateLocationProblem(document)).toBeNull();
  });
  it.each([["17:00", "09:00"], ["09:00", "09:00"]])("rejects nonpositive %s–%s ranges", (start, end) => {
    const document = valid(); Object.assign(document.dates[0], { start, end });
    expect(dateLocationProblem(document)).toMatch(/after/);
  });
  it("synchronizes windows from each date while preserving stored session ids", () => {
    const document = valid(); document.dates[0].session_id = "saved-session";
    expect(dateSessions(document)).toEqual([{ id: "saved-session", name: "Opening", start_time: "2026-11-14T16:00:00.000Z", end_time: "2026-11-15T00:00:00.000Z" }]);
    expect(document.dates[0].location).toBeNull();
  });
});
