import { describe, expect, it } from "vitest";
import { eventSlugError, eventSlugStem, priceError, suggestedEventSlug, uniqueEventSlug, websiteUrlError } from "./event-configuration";

describe("event configuration validation", () => {
  it("suggests stable, valid slugs without using reserved routes", () => {
    expect(suggestedEventSlug("Design Sprint 2026!")).toBe("design-sprint-2026");
    expect(suggestedEventSlug("Admin")).toBe("admin-event");
    expect(suggestedEventSlug("")).toBe("");
  });
  it("numbers a suggested URL past the ones other events hold", () => {
    expect(uniqueEventSlug("coffee-chat", [])).toBe("coffee-chat");
    expect(uniqueEventSlug("coffee-chat", ["coffee-chat"])).toBe("coffee-chat-1");
    expect(uniqueEventSlug("coffee-chat", ["coffee-chat", "coffee-chat-1", "coffee-chat-2"])).toBe("coffee-chat-3");
    expect(uniqueEventSlug("sprint-2026", ["sprint-2026"])).toBe("sprint-2026-1");
  });
  it("keeps the URL an event already holds instead of bumping it", () => {
    expect(uniqueEventSlug("coffee-chat", ["coffee-chat"], "coffee-chat-1")).toBe("coffee-chat-1");
    // A lower number freed since does not move it.
    expect(uniqueEventSlug("coffee-chat", ["coffee-chat"], "coffee-chat-3")).toBe("coffee-chat-3");
    expect(uniqueEventSlug("coffee-chat", [], "coffee-chat")).toBe("coffee-chat");
    expect(uniqueEventSlug("sprint-2026", [], "sprint-2026")).toBe("sprint-2026");
    // A URL from an old name, or one another event now holds, is replaced.
    expect(uniqueEventSlug("tea-time", ["tea-time"], "coffee-chat-1")).toBe("tea-time-1");
    expect(uniqueEventSlug("coffee-chat", ["coffee-chat", "coffee-chat-1"], "coffee-chat-1")).toBe("coffee-chat-2");
    expect(uniqueEventSlug("coffee-chat", [], "coffee-chatter")).toBe("coffee-chat");
  });
  it("keeps numbered URLs valid at the 100-character limit", () => {
    const base = suggestedEventSlug(`${"a".repeat(98)} b`);
    expect(base).toHaveLength(100);
    const numbered = uniqueEventSlug(base, [base]);
    expect(numbered).toBe(`${"a".repeat(98)}-1`);
    expect(eventSlugError(numbered)).toBeNull();
    expect(numbered.startsWith(eventSlugStem(base))).toBe(true);
  });
  it.each(["", "UPPER", "has space", "admin", "../other", "a".repeat(101)])("rejects invalid slug %s", value => expect(eventSlugError(value)).not.toBeNull());
  it.each(["javascript:alert(1)", "https://name:password@example.com", "https://", "example.com", "https://exa mple.com"])("rejects unsafe or incomplete website %s", value => expect(websiteUrlError(value)).not.toBeNull());
  it("accepts complete website URLs and cent-precise prices", () => {
    expect(websiteUrlError("https://devpost.com/event?q=hello#details")).toBeNull();
    for (const value of ["0", "10", "10.50", "0.01"]) expect(priceError(value)).toBeNull();
  });
  it.each(["", "-1", "NaN", "Infinity", "1.001", "1e3", "1000000"])("rejects invalid price %s", value => expect(priceError(value)).not.toBeNull());
});
