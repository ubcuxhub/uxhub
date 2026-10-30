import { describe, expect, it } from "vitest";

import { isAgendaDayToday, isAgendaItemHappening } from "./event-agenda";

const item = { start_time: "09:30:00", end_time: "11:00:00" };
const at = (date: string, time: string) => ({ date, time });

describe("isAgendaDayToday", () => {
  it("matches only the same date", () => {
    expect(isAgendaDayToday("2026-10-22", at("2026-10-22", "08:00"))).toBe(true);
    expect(isAgendaDayToday("2026-10-23", at("2026-10-22", "08:00"))).toBe(false);
  });

  it("is false before the client knows the time", () => {
    expect(isAgendaDayToday("2026-10-22", null)).toBe(false);
  });
});

describe("isAgendaItemHappening", () => {
  it("is true from the start time until just before the end time", () => {
    expect(isAgendaItemHappening("2026-10-22", item, at("2026-10-22", "09:30"))).toBe(true);
    expect(isAgendaItemHappening("2026-10-22", item, at("2026-10-22", "10:59"))).toBe(true);
  });

  it("is false before it starts and once it ends", () => {
    expect(isAgendaItemHappening("2026-10-22", item, at("2026-10-22", "09:29"))).toBe(false);
    expect(isAgendaItemHappening("2026-10-22", item, at("2026-10-22", "11:00"))).toBe(false);
  });

  it("is false at the right time on a different day", () => {
    expect(isAgendaItemHappening("2026-10-23", item, at("2026-10-22", "10:00"))).toBe(false);
  });

  it("is false before the client knows the time", () => {
    expect(isAgendaItemHappening("2026-10-22", item, null)).toBe(false);
  });
});
