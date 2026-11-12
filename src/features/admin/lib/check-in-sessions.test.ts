import { describe, expect, it } from "vitest";

import { defaultCheckInSessionId } from "./check-in-sessions";

const doors = {
  id: "doors",
  start_time: "2026-11-04T01:00:00Z",
  end_time: "2026-11-04T02:00:00Z",
};
const talks = {
  id: "talks",
  start_time: "2026-11-04T03:00:00Z",
  end_time: "2026-11-04T05:00:00Z",
};
const sessions = [doors, talks];

describe("defaultCheckInSessionId", () => {
  it("picks the session running now", () => {
    expect(defaultCheckInSessionId(sessions, new Date("2026-11-04T03:30:00Z"))).toBe("talks");
  });

  it("counts a session's start and end as running", () => {
    expect(defaultCheckInSessionId(sessions, new Date(doors.start_time))).toBe("doors");
    expect(defaultCheckInSessionId(sessions, new Date(doors.end_time))).toBe("doors");
  });

  it("picks the next session between sessions or before the first", () => {
    expect(defaultCheckInSessionId(sessions, new Date("2026-11-04T02:30:00Z"))).toBe("talks");
    expect(defaultCheckInSessionId(sessions, new Date("2026-11-03T20:00:00Z"))).toBe("doors");
  });

  it("picks the last session once they are all over", () => {
    expect(defaultCheckInSessionId(sessions, new Date("2026-11-05T00:00:00Z"))).toBe("talks");
  });

  it("falls back to the last session when none has times", () => {
    const untimed = [
      { id: "a", start_time: null, end_time: null },
      { id: "b", start_time: null, end_time: null },
    ];

    expect(defaultCheckInSessionId(untimed, new Date())).toBe("b");
  });

  it("returns null without sessions", () => {
    expect(defaultCheckInSessionId([], new Date())).toBeNull();
  });
});
