import { describe, expect, it } from "vitest";
import { agendaCheckInHref, defaultAgendaDayId, selectedAgendaDayId } from "./staff-agenda";

const days = [
  { id: "last", date: "2027-12-20" },
  { id: "first", date: "2027-12-01" },
  { id: "middle", date: "2027-12-10" },
];

describe("staff agenda", () => {
  it("chooses today, next or last across nonconsecutive weeks without mutating input", () => {
    expect(defaultAgendaDayId(days, new Date("2027-12-10T20:00:00Z"))).toBe("middle");
    expect(defaultAgendaDayId(days, new Date("2027-12-02T20:00:00Z"))).toBe("middle");
    expect(defaultAgendaDayId(days, new Date("2027-12-25T20:00:00Z"))).toBe("last");
    expect(defaultAgendaDayId([], new Date())).toBeNull();
    expect(days[0].id).toBe("last");
  });
  it("uses Vancouver's calendar date rather than UTC or the viewer's timezone", () => {
    expect(defaultAgendaDayId(days, new Date("2027-12-11T01:00:00Z"))).toBe("middle");
    expect(defaultAgendaDayId(days, new Date("2027-12-11T07:00:00Z"))).toBe("last");
  });
  it("carries the exact stable identity into the check-in URL", () => {
    expect(agendaCheckInHref("event-id", "item-id")).toBe("/admin/events/event-id/check-in?item=item-id&returnTo=%2Fadmin%2Fevents%2Fevent-id%2Fagenda");
  });
});

it("restores a valid day and retains defaults for invalid or missing day links", () => {
  expect(selectedAgendaDayId(days, "first", new Date("2027-12-10T20:00:00Z"))).toBe("first");
  expect(selectedAgendaDayId(days, "foreign", new Date("2027-12-10T20:00:00Z"))).toBe("middle");
  expect(selectedAgendaDayId(days, undefined, new Date("2027-12-10T20:00:00Z"))).toBe("middle");
});
