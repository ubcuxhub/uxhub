import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { errorFields, log } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("errorFields", () => {
  it("records the error type without its message", () => {
    const fields = errorFields(
      new Error("duplicate key: student@example.com already exists")
    );

    expect(fields).toEqual({ errorType: "Error" });
    expect(JSON.stringify(fields)).not.toContain("student@example.com");
  });

  it("keeps a custom error name", () => {
    class SquareError extends Error {
      name = "SquareError";
    }

    expect(errorFields(new SquareError("declined"))).toEqual({
      errorType: "SquareError",
    });
  });

  it("reads the code off a database error", () => {
    expect(errorFields({ code: "23505", details: "student@example.com" })).toEqual({
      errorType: "SupabaseError",
      code: "23505",
    });
  });

  it("falls back to the value type", () => {
    expect(errorFields("boom")).toEqual({ errorType: "string" });
    expect(errorFields(null)).toEqual({ errorType: "object" });
  });
});

describe("log", () => {
  it("emits one parseable JSON line in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.error("payment.ticket_charge_failed", {
      purchaseId: "pur_1",
      ...errorFields(new Error("card data")),
    });

    expect(spy).toHaveBeenCalledOnce();

    const [line] = spy.mock.calls[0] as [string];

    expect(JSON.parse(line)).toEqual({
      level: "error",
      event: "payment.ticket_charge_failed",
      time: expect.any(String),
      purchaseId: "pur_1",
      errorType: "Error",
    });
  });

  it("sends info and warn to the standard stream", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = vi.spyOn(console, "log").mockImplementation(() => {});

    log.info("email.skipped_no_api_key", { subject: "Your receipt" });
    log.warn("payment.reconciliation_failed", { purchaseId: "pur_1" });

    expect(error).not.toHaveBeenCalled();
    expect(out).toHaveBeenCalledTimes(2);
  });

  it("stays readable outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.error("webhook.square_handling_failed", { errorType: "Error" });

    expect(spy).toHaveBeenCalledWith(
      'error webhook.square_handling_failed {"errorType":"Error"}'
    );
  });

  it("omits empty fields", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.error("checkout.submit_failed");

    expect(spy).toHaveBeenCalledWith("error checkout.submit_failed");
  });
});
