import { describe, expect, it } from "vitest";

import { meetingPlatform } from "./meeting-platform";

describe("meetingPlatform", () => {
  it("names the platforms students meet on, including subdomains", () => {
    expect(meetingPlatform("https://ubc.zoom.us/j/1234567890")).toBe("Zoom");
    expect(meetingPlatform("https://zoom.us/j/1")).toBe("Zoom");
    expect(meetingPlatform("https://meet.google.com/abc-defg-hij")).toBe("Google Meet");
    expect(meetingPlatform("https://teams.microsoft.com/l/meetup-join/x")).toBe("Microsoft Teams");
  });

  it("names nothing for an unknown host, a lookalike or a non-URL", () => {
    expect(meetingPlatform("https://example.com/meet")).toBeNull();
    expect(meetingPlatform("https://notzoom.us/j/1")).toBeNull();
    expect(meetingPlatform("not a url")).toBeNull();
    expect(meetingPlatform(null)).toBeNull();
  });
});
