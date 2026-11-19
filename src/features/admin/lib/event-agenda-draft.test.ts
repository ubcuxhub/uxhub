import { describe, it, expect } from "vitest";
import { agendaEnvelope, agendaProjection, dateLocationProblem, dateSessions, emptyAgendaDay, emptyAgendaItem, emptyLocation, parseDateLocationDraft, withAgendaSessionIds, type EventDateLocationDraft } from "./event-date-location";

const agenda = (): EventDateLocationDraft => {
  const day = { ...emptyAgendaDay(), date: "2025-11-02", label: "Workshop", location: { ...emptyLocation(), building: "Nest", address: "UBC" } };
  day.items = [{ ...emptyAgendaItem(day.date), label: "Late session", start: "21:00", end_date: "2025-11-03", end: "02:00" }];
  return { version: 2, automatic: true, audience: "everyone", location: day.location, dates: [day] };
};

describe("unified agenda authority", () => {
  it("derives overnight envelopes from all items with zero check-in items", () => {
    const value = agenda();
    value.dates.push({ ...value.dates[0], key: crypto.randomUUID(), date: "2025-11-23", items: [{ ...emptyAgendaItem("2025-11-23"), label: "Closing", start: "09:00", end: "10:00" }] });
    expect(dateLocationProblem(value)).toBeNull();
    expect(dateSessions(value)).toEqual([]);
    expect(agendaEnvelope(value)).toEqual({ starts_at: "2025-11-02T21:00", ends_at: "2025-11-23T10:00" });
    expect(agendaProjection(value).dates[0].start).toBe("21:00");
  });
  it("rejects clock gaps, repeated times and nonpositive intervals", () => {
    const value = agenda(); const item = value.dates[0].items![0];
    item.start = "01:30";
    expect(dateLocationProblem(value)).toMatch(/unambiguous/);
    value.dates[0].date = "2025-03-09"; item.start = "02:30";
    expect(dateLocationProblem(value)).toMatch(/unambiguous/);
    value.dates[0].date = "2026-11-15"; item.start = "13:00"; item.end_date = "2026-11-15"; item.end = "12:00";
    expect(dateLocationProblem(value)).toMatch(/after/);
  });
  it("retains incomplete drafts, enforces complete days and uses strict Pacific conversion", () => {
    const value = agenda(); value.dates[0].items = [];
    expect(parseDateLocationDraft(value)).toBe(value);
    expect(dateLocationProblem(value)).toMatch(/at least one/);
    const restored = agenda(); restored.dates[0].items![0].check_in = true;
    expect(dateSessions(restored)[0]).toMatchObject({ start_time: "2025-11-03T05:00:00.000Z", end_time: "2025-11-03T10:00:00.000Z" });
    expect(withAgendaSessionIds(restored,["canonical"]).dates[0].items![0].session_id).toBe("canonical");
  });
  it("validates inherited/overridden locations and retains inactive values", () => {
    const value = agenda(); value.audience = "going";
    expect(dateLocationProblem(value)).toMatch(/public location summary/);
    value.dates[0].location!.public_summary = "UBC";
    value.dates[0].location!.meeting_url = "unfinished hidden field";
    expect(dateLocationProblem(value)).toBeNull();
    value.dates[0].items![0].location = { ...emptyLocation(), type: "online", meeting_url: "https://example.com", public_summary: "Online" };
    expect(dateLocationProblem(value)).toBeNull();
    value.dates[0].items![0].location!.meeting_url = "javascript:alert(1)";
    expect(() => parseDateLocationDraft(value)).toThrow();
  });
});
