import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCronSignature } from "./cron-signature";

const NOW = new Date("2026-11-20T20:00:00Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
const options = { secret: "test-secret", purpose: "event-reminders", headerPrefix: "x-event-reminders" };

function sign(message: string, secret = "test-secret") {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function request(timestamp: string | number, signature: string, prefix = "x-event-reminders") {
  return new Request("https://example.test/api/internal/x", {
    method: "POST",
    headers: { [`${prefix}-timestamp`]: String(timestamp), [`${prefix}-signature`]: signature },
  });
}

describe("verifyCronSignature", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a fresh signature over the purpose and timestamp", () => {
    expect(verifyCronSignature(request(NOW_SECONDS, sign(`event-reminders:${NOW_SECONDS}`)), options)).toBe(true);
  });

  it("accepts a timestamp up to five minutes either side", () => {
    for (const at of [NOW_SECONDS - 300, NOW_SECONDS + 300]) {
      expect(verifyCronSignature(request(at, sign(`event-reminders:${at}`)), options)).toBe(true);
    }
  });

  it.each([
    ["another route's signature", NOW_SECONDS, sign(`application-emails:${NOW_SECONDS}`)],
    ["another secret", NOW_SECONDS, sign(`event-reminders:${NOW_SECONDS}`, "other")],
    ["a stale timestamp", NOW_SECONDS - 301, sign(`event-reminders:${NOW_SECONDS - 301}`)],
    ["a future timestamp", NOW_SECONDS + 301, sign(`event-reminders:${NOW_SECONDS + 301}`)],
    ["a malformed timestamp", "17639", sign("event-reminders:17639")],
    ["a malformed signature", NOW_SECONDS, "not-hex"],
    ["an uppercase signature", NOW_SECONDS, sign(`event-reminders:${NOW_SECONDS}`).toUpperCase()],
  ])("rejects %s", (_label, timestamp, signature) => {
    expect(verifyCronSignature(request(timestamp, signature), options)).toBe(false);
  });

  it("rejects the right signature under the wrong headers", () => {
    const signed = request(NOW_SECONDS, sign(`event-reminders:${NOW_SECONDS}`), "x-application-emails");
    expect(verifyCronSignature(signed, options)).toBe(false);
  });

  it("stays shut while the secret is unset", () => {
    const signed = request(NOW_SECONDS, sign(`event-reminders:${NOW_SECONDS}`));
    expect(verifyCronSignature(signed, { ...options, secret: undefined })).toBe(false);
    expect(verifyCronSignature(signed, { ...options, secret: "" })).toBe(false);
  });
});
