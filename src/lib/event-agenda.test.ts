import { describe, expect, it } from "vitest";
import { agendaDayLabel, agendaPages, agendaTimeRange, agendaWeeks, defaultAgendaPage } from "@/lib/event-agenda";
import type { EventAgendaDay } from "@/lib/supabase-helpers/event-agenda";

const item = { starts_at: "2026-11-21T06:00:00Z", ends_at: "2026-11-21T09:00:00Z" };
const day = (date: string): EventAgendaDay => ({ id: date, date, title: date, location_overridden: false, location: null, items: [] });
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
    ["2026-05-01", "Fri, May 1"], ["2026-05-11", "Mon, May 11"],
    ["2026-05-16", "Sat, May 16"], ["2026-11-14", "Sat, Nov 14"],
  ])("formats %s as %s, with no ordinal (Figma)", (date, expected) => {
    expect(agendaDayLabel(date)).toBe(expected);
  });
  it("shows Pacific time ranges without dates or a year, sharing AM or PM when both ends do", () => {
    expect(agendaTimeRange({ starts_at: "2026-05-16T17:15:00Z", ends_at: "2026-05-16T18:30:00Z" })).toBe("10:15–11:30 AM");
    expect(agendaTimeRange({ starts_at: "2026-05-16T17:30:00Z", ends_at: "2026-05-16T19:00:00Z" })).toBe("10:30 AM–12:00 PM");
    expect(agendaTimeRange(item)).toBe("11:00 PM–2:00 AM");
    expect(agendaTimeRange({ starts_at: null, ends_at: null })).toBe("Time to be confirmed");
  });
});

describe("agenda pagination", () => {
  const pages = (dates: string[]) => agendaPages(dates.map(day)).map(page => [page.label, page.days.map(d => d.date)]);

  it("makes a single day one page, and gives days within one week a page each", () => {
    expect(pages(["2027-01-11"])).toEqual([["Mon, Jan 11", ["2027-01-11"]]]);
    expect(pages(["2027-01-10", "2027-01-09"])).toEqual([["Sat, Jan 9", ["2027-01-09"]], ["Sun, Jan 10", ["2027-01-10"]]]);
    expect(agendaPages([])).toEqual([]);
  });

  it("uses week tabs when the agenda spans several weeks and any week holds two or more days", () => {
    expect(pages(["2026-11-14", "2026-11-16", "2026-11-28"]))
      .toEqual([["Week 1", ["2026-11-14", "2026-11-16"]], ["Week 3", ["2026-11-28"]]]);
  });

  it("uses a tab per day, labelled with the date, when every day sits in its own week", () => {
    expect(pages(["2026-10-30", "2027-04-01"])).toEqual([["Fri, Oct 30", ["2026-10-30"]], ["Thu, Apr 1", ["2027-04-01"]]]);
  });

  it("opens on the tab holding today, else the next one, else the last", () => {
    const weeks = agendaPages(["2026-11-14", "2026-11-16", "2026-11-21", "2026-11-23"].map(day));
    expect(weeks.map(page => page.key)).toEqual(["week-1", "week-2"]);
    expect(defaultAgendaPage(weeks, "2026-11-01")).toBe("week-1");
    expect(defaultAgendaPage(weeks, "2026-11-16")).toBe("week-1");
    expect(defaultAgendaPage(weeks, "2026-11-18")).toBe("week-2");
    expect(defaultAgendaPage(weeks, "2026-11-23")).toBe("week-2");
    expect(defaultAgendaPage(weeks, "2026-12-25")).toBe("week-2");
    expect(defaultAgendaPage(weeks)).toBe("week-1");
    expect(defaultAgendaPage([], "2026-11-16")).toBeUndefined();
  });
});
