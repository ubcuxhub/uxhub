import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createHmac } from "node:crypto";

const mocks = vi.hoisted(() => ({ find: vi.fn(), error: vi.fn(), flush: vi.fn() }));
vi.mock("@/lib/supabase-helpers/admin-server", () => ({ adminFindOverduePublications: mocks.find }));
vi.mock("@/lib/log", () => ({ log: { error: mocks.error }, errorFields: () => ({ code: "08006" }) }));
vi.mock("@sentry/nextjs", () => ({ flush: mocks.flush }));

function request(secret = "test-secret", timestamp = String(Math.floor(Date.now() / 1000))) {
  return new Request("https://example.com/api/internal/event-publication", {
    method: "POST", headers: {
      "x-publication-timestamp": timestamp,
      "x-publication-signature": createHmac("sha256", secret).update(`event-publication:${timestamp}`).digest("hex"),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EVENT_PUBLICATION_HEALTH_SECRET", "test-secret");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T20:00:00Z"));
  mocks.find.mockResolvedValue(0);
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("publication health notifications", () => {
  it.each(["", "wrong", "test-secrex"])("rejects invalid authentication %s", async (token) => {
    expect((await POST(request(token))).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it.each(["0", "1793217000", "1793218200", "invalid"])("rejects stale, future or malformed timestamps %s", async (timestamp) => {
    expect((await POST(request("test-secret", timestamp))).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("rejects unsigned requests", async () => {
    expect((await POST(new Request("https://example.com", { method: "POST" }))).status).toBe(401);
  });
  it("fails closed without a configured secret", async () => {
    vi.stubEnv("EVENT_PUBLICATION_HEALTH_SECRET", "");
    expect((await POST(request("Bearer "))).status).toBe(401);
  });
  it("does not alert when publication has recovered", async () => {
    expect(await (await POST(request())).json()).toEqual({ overdue: 0 });
    expect(mocks.find).toHaveBeenCalledWith("2026-10-28T19:55:00.000Z");
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("reports overdue publications and flushes Sentry before responding", async () => {
    mocks.find.mockResolvedValue(2);
    expect(await (await POST(request())).json()).toEqual({ overdue: 2 });
    expect(mocks.error).toHaveBeenCalledWith("event.publication_overdue", {
      count: 2, before: "2026-10-28T19:55:00.000Z",
    });
    expect(mocks.flush).toHaveBeenCalledWith(2000);
  });
  it("returns a retryable failure without leaking database messages", async () => {
    mocks.find.mockRejectedValue(new Error("private row data"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.error).toHaveBeenCalledWith("event.publication_health_check_failed", { code: "08006" });
  });
});
