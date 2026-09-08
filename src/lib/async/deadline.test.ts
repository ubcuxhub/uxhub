import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AsyncTimeoutError,
  getAsyncErrorMessage,
  withDeadline,
} from "./deadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("withDeadline", () => {
  it("returns a result completed before the deadline", async () => {
    await expect(
      withDeadline(async () => "done", { timeoutMs: 100 }),
    ).resolves.toBe("done");
  });

  it("rejects and aborts cooperative work at the deadline", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;

    const pending = withDeadline(
      async (signal) => {
        observedSignal = signal;
        return await new Promise<string>(() => undefined);
      },
      { operation: "Profile save", timeoutMs: 100 },
    );
    const rejection = expect(pending).rejects.toEqual(
      expect.objectContaining({
        name: "AsyncTimeoutError",
        timeoutMs: 100,
      }),
    );

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
    expect(observedSignal?.aborted).toBe(true);
  });

  it("forwards caller cancellation", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Unmounted", "AbortError");

    const pending = withDeadline(
      async () => await new Promise<string>(() => undefined),
      { signal: controller.signal, timeoutMs: 1_000 },
    );

    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
  });

  it("does not leave a late rejection unhandled after the deadline", async () => {
    vi.useFakeTimers();
    let rejectLate: ((error: Error) => void) | undefined;

    const pending = withDeadline(
      async () =>
        await new Promise<string>((_, reject) => {
          rejectLate = reject;
        }),
      { timeoutMs: 100 },
    );
    const timeout = expect(pending).rejects.toBeInstanceOf(AsyncTimeoutError);

    await vi.advanceTimersByTimeAsync(100);
    await timeout;

    expect(() => rejectLate?.(new Error("late failure"))).not.toThrow();
    await Promise.resolve();
  });

  it("rejects immediately when the caller is already cancelled", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Unmounted", "AbortError");
    controller.abort(reason);

    await expect(
      withDeadline(async () => await new Promise<string>(() => undefined), {
        signal: controller.signal,
        timeoutMs: 1_000,
      }),
    ).rejects.toBe(reason);
  });

  it("maps timeouts to stable user-facing copy", () => {
    expect(getAsyncErrorMessage(new AsyncTimeoutError(100))).toBe(
      "This is taking longer than expected. Check your connection and try again.",
    );
  });
});
