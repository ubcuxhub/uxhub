import { describe, expect, it } from "vitest";

import { toTicketEvent } from "./ticket";

const event = {
  name: "Design Sprint",
  start_date: "2026-11-04",
  end_date: "2026-11-04",
  start_time: "18:00:00",
  end_time: "20:30:00",
  location_building: "ICICS",
  location_room: "X150",
};

describe("toTicketEvent", () => {
  it("formats a single-day event", () => {
    expect(toTicketEvent(event)).toEqual({
      name: "Design Sprint",
      date: "November 4, 2026",
      time: "6:00 p.m. – 8:30 p.m.",
      location: "ICICS, X150",
    });
  });

  it("shows a date range for a multi-day event", () => {
    expect(
      toTicketEvent({ ...event, end_date: "2026-11-06" }).date
    ).toBe("November 4, 2026 – November 6, 2026");
  });

  it("leaves unscheduled details empty for the ticket to fill in", () => {
    expect(
      toTicketEvent({
        ...event,
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        location_building: null,
        location_room: null,
      })
    ).toEqual({ name: "Design Sprint", date: null, time: null, location: null });
  });

  it("shows a start time on its own when there is no end time", () => {
    expect(toTicketEvent({ ...event, end_time: null }).time).toBe("6:00 p.m.");
  });
});
