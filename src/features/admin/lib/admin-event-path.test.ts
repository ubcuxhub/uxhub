import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  RESERVED_ADMIN_EVENT_SEGMENTS,
  adminEventKey,
  adminEventPath,
} from "./admin-event-path";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("adminEventPath", () => {
  it("keys an event's admin URLs by its slug", () => {
    const event = { id: EVENT_ID, slug: "portfolio-night" };
    expect(adminEventPath(event)).toBe("/admin/events/portfolio-night");
    expect(adminEventPath(event, "/edit")).toBe("/admin/events/portfolio-night/edit");
    expect(adminEventPath(event, "/check-in/scan")).toBe(
      "/admin/events/portfolio-night/check-in/scan"
    );
  });

  it("falls back to the ID for a slug a static route would shadow, or none", () => {
    for (const slug of RESERVED_ADMIN_EVENT_SEGMENTS) {
      expect(adminEventPath({ id: EVENT_ID, slug })).toBe(`/admin/events/${EVENT_ID}`);
    }
    expect(adminEventKey({ id: EVENT_ID, slug: null })).toBe(EVENT_ID);
    expect(adminEventKey({ id: EVENT_ID, slug: "" })).toBe(EVENT_ID);
  });
});

describe("RESERVED_ADMIN_EVENT_SEGMENTS", () => {
  it("lists every static route beside [event] under /admin/events", () => {
    const dir = path.join(process.cwd(), "src/app/(app)/(shell)/admin/events");
    const statics = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      // Dynamic segments and route groups don't take a URL name.
      .filter((name) => !name.startsWith("[") && !name.startsWith("("));
    expect(new Set(statics)).toEqual(RESERVED_ADMIN_EVENT_SEGMENTS);
  });
});
