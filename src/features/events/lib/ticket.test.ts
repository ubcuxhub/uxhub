import { describe, expect, it } from "vitest";

import { toTicketEvent } from "./ticket";

const event = {
  name: "Design Sprint",
  // 6:00 PM – 8:30 PM PST on November 4. A past year, so a change to
  // Vancouver's future offsets can't move it.
  starts_at: "2025-11-05T02:00:00+00:00",
  ends_at: "2025-11-05T04:30:00+00:00",
  location_building: "ICICS",
  location_room: "X150",
};

describe("toTicketEvent", () => {
  it("formats a single-day event", () => {
    expect(toTicketEvent(event)).toEqual({
      name: "Design Sprint",
      date: "November 4, 2025",
      time: "6:00 PM – 8:30 PM",
      location: "ICICS, X150",
    });
  });

  it("shows a date range for a multi-day event", () => {
    expect(
      toTicketEvent({ ...event, ends_at: "2025-11-07T04:30:00+00:00" }).date
    ).toBe("November 4, 2025 – November 6, 2025");
  });

  it("leaves unscheduled details empty for the ticket to fill in", () => {
    expect(
      toTicketEvent({
        ...event,
        starts_at: null,
        ends_at: null,
        location_building: null,
        location_room: null,
      })
    ).toEqual({ name: "Design Sprint", date: null, time: null, location: null });
  });

  it("shows a start time on its own when there is no end time", () => {
    expect(toTicketEvent({ ...event, ends_at: null }).time).toBe("6:00 PM");
  });
});
