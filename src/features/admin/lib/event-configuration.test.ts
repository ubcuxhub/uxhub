import { describe, expect, it } from "vitest";
import { eventSlugError, priceError, suggestedEventSlug, websiteUrlError } from "./event-configuration";

describe("event configuration validation", () => {
  it("suggests stable, valid slugs without using reserved routes", () => {
    expect(suggestedEventSlug("Design Sprint 2026!")).toBe("design-sprint-2026");
    expect(suggestedEventSlug("Admin")).toBe("admin-event");
    expect(suggestedEventSlug("")).toBe("");
  });
  it.each(["", "UPPER", "has space", "admin", "../other", "a".repeat(101)])("rejects invalid slug %s", value => expect(eventSlugError(value)).not.toBeNull());
  it.each(["javascript:alert(1)", "https://name:password@example.com", "https://", "example.com", "https://exa mple.com"])("rejects unsafe or incomplete website %s", value => expect(websiteUrlError(value)).not.toBeNull());
  it("accepts complete website URLs and cent-precise prices", () => {
    expect(websiteUrlError("https://devpost.com/event?q=hello#details")).toBeNull();
    for (const value of ["0", "10", "10.50", "0.01"]) expect(priceError(value)).toBeNull();
  });
  it.each(["", "-1", "NaN", "Infinity", "1.001", "1e3", "1000000"])("rejects invalid price %s", value => expect(priceError(value)).not.toBeNull());
});
