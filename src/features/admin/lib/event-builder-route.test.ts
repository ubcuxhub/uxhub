import { describe, expect, it } from "vitest";
import { isEventBuilderPath } from "./event-builder-route";

describe("event builder shell routes", () => {
  it.each(["/admin/events/create-new", "/admin/events/drafts/draft-id", "/admin/events/event-id/edit"])("uses the builder shell for %s", path => {
    expect(isEventBuilderPath(path)).toBe(true);
  });
  it.each(["/admin/events", "/admin/events/event-id", "/admin/events/event-id/check-in", "/admin/events/event-id/review-applications", "/portal/events/event-slug"])("keeps the browsing shell for %s", path => {
    expect(isEventBuilderPath(path)).toBe(false);
  });
});
