import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";
import { submitCheckoutAction } from "./actions";

vi.mock("server-only", () => ({}));

const guardMocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));
const fulfillmentMocks = vi.hoisted(() => ({ executeCheckoutForUser: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ requireAuth: guardMocks.requireAuth }));

vi.mock("./fulfillment", () => ({
  executeCheckoutForUser: fulfillmentMocks.executeCheckoutForUser,
}));

// `parseCheckoutRequest` and the logger are left real. Mocking the parser here
// would only prove the mock rejects what it was told to reject, and the logger
// is the thing that decides what a failure is allowed to record.

const user = { id: "user-1" } as UserInfoRow;

const validRequest = {
  kind: "membership",
  slug: "annual-membership",
  token: "cnon:card-nonce-ok",
  idempotencyKey: "idem-1",
  expectedAmountCents: 2000,
  verificationToken: "verify-1",
};

let consoleError: ReturnType<typeof vi.spyOn>;
let consoleLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  guardMocks.requireAuth.mockResolvedValue(user);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  consoleLog.mockRestore();
});

describe("submitCheckoutAction", () => {
  it("hands the parsed request to fulfillment and returns its result unchanged", async () => {
    const success = {
      ok: true as const,
      purchaseId: "purchase-1",
      resolution: "completed" as const,
    };
    fulfillmentMocks.executeCheckoutForUser.mockResolvedValue(success);

    await expect(submitCheckoutAction(validRequest)).resolves.toBe(success);

    expect(guardMocks.requireAuth).toHaveBeenCalledOnce();
    expect(fulfillmentMocks.executeCheckoutForUser).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        kind: "membership",
        slug: "annual-membership",
        token: "cnon:card-nonce-ok",
        idempotencyKey: "idem-1",
        verificationToken: "verify-1",
      })
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown purchase kind", { ...validRequest, kind: "donation" }, "Invalid purchase kind."],
    ["a missing slug", { ...validRequest, slug: " " }, "Product slug is required."],
    ["a non-object payload", "nonsense", "Invalid checkout payload."],
    ["null", null, "Invalid checkout payload."],
  ])("refuses %s as final, without reaching Square or alerting", async (_label, input, message) => {
    const result = await submitCheckoutAction(input);

    expect(result).toEqual({ ok: false, error: message, terminal: true });
    expect(fulfillmentMocks.executeCheckoutForUser).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(String(consoleLog.mock.calls[0]?.[0])).toContain("checkout.request_invalid");
  });

  // An error thrown mid-flight tells us nothing about whether Square took the
  // money, so the result must stay non-terminal: terminal: true would invite a
  // retry that double-charges.
  it("reports an unexpected fulfillment failure as non-terminal", async () => {
    fulfillmentMocks.executeCheckoutForUser.mockRejectedValue(
      new Error("socket hang up")
    );

    const result = await submitCheckoutAction(validRequest);

    expect(result).toMatchObject({ ok: false, terminal: false });
  });

  it("keeps the underlying error out of the member-facing message", async () => {
    fulfillmentMocks.executeCheckoutForUser.mockRejectedValue(
      new Error(
        'duplicate key value violates unique constraint "purchases_idempotency_key" for jamie@example.com'
      )
    );

    const result = await submitCheckoutAction(validRequest);

    expect(result).toEqual({
      ok: false,
      error:
        "Checkout could not be confirmed. Check your purchases before trying again.",
      terminal: false,
    });
  });

  it("logs the failure as a structured event carrying no row data", async () => {
    fulfillmentMocks.executeCheckoutForUser.mockRejectedValue(
      new Error('constraint "purchases_idempotency_key" for jamie@example.com')
    );

    await submitCheckoutAction(validRequest);

    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0]?.[0]);

    expect(line).toContain("checkout.submit_failed");
    expect(line).toContain("errorType");
    expect(line).not.toContain("jamie@example.com");
    expect(line).not.toContain("purchases_idempotency_key");
  });

  // requireAuth redirects by throwing, and it sits outside the try block on
  // purpose. Swallowing it would turn "you are signed out" into "your payment
  // failed" and leave the member on a dead checkout form.
  it("lets an authentication redirect propagate", async () => {
    guardMocks.requireAuth.mockRejectedValue(new Error("NEXT_REDIRECT /auth/login"));

    await expect(submitCheckoutAction(validRequest)).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(fulfillmentMocks.executeCheckoutForUser).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
