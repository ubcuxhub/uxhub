import { describe, expect, it } from "vitest";
import { agendaDayLabel, agendaTimeRange, agendaWeeks } from "@/lib/event-agenda";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";

const item = { starts_at: "2026-11-21T06:00:00Z", ends_at: "2026-11-21T09:00:00Z" };
const day = (date: string): EventAgendaDay => ({ id: date, date, title: date, location: null, items: [] });
describe("participant agenda dates", () => {
  it("anchors seven-calendar-day weeks to the earliest day, preserving gaps and year boundaries", () => {
    expect(agendaWeeks([day("2027-01-19"), day("2026-12-31"), day("2027-01-06"), day("2027-01-07")]).map(w => [w.number, w.days.map(d => d.date)]))
      .toEqual([[1, ["2026-12-31", "2027-01-06"]], [2, ["2027-01-07"]], [3, ["2027-01-19"]]]);
    expect(agendaWeeks([])).toEqual([]);
  });
  it("uses calendar dates rather than elapsed DST hours for week grouping", () => {
    expect(agendaWeeks([day("2025-03-05"), day("2025-03-12")]).map(w => w.number)).toEqual([1, 2]);
  });
  it.each([
    ["2026-05-01", "Fri, May 1st"], ["2026-05-02", "Sat, May 2nd"],
    ["2026-05-03", "Sun, May 3rd"], ["2026-05-11", "Mon, May 11th"],
    ["2026-05-12", "Tue, May 12th"], ["2026-05-13", "Wed, May 13th"],
    ["2026-05-16", "Sat, May 16th"], ["2026-05-21", "Thu, May 21st"],
  ])("formats %s as %s", (date, expected) => {
    expect(agendaDayLabel(date)).toBe(expected);
  });
  it("shows Pacific time ranges without dates or a year", () => {
    expect(agendaTimeRange({ starts_at: "2026-05-16T17:15:00Z", ends_at: "2026-05-16T18:30:00Z" })).toBe("10:15 AM – 11:30 AM");
    expect(agendaTimeRange(item)).toBe("11:00 PM – 2:00 AM");
    expect(agendaTimeRange({ starts_at: null, ends_at: null })).toBe("Time to be confirmed");
  });
});
