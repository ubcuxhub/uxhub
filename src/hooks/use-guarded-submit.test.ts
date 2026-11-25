// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";

import { NAVIGATED, useGuardedSubmit } from "./use-guarded-submit";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useGuardedSubmit", () => {
  it("ignores a second run while the first is in flight, then unlocks", async () => {
    const { result } = renderHook(() => useGuardedSubmit(() => {}));
    let finish!: () => void;
    const first = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const second = vi.fn(async () => {});

    let running!: Promise<void>;
    act(() => {
      running = result.current.run(first);
    });
    expect(result.current.pending).toBe(true);
    await act(() => result.current.run(second));
    expect(second).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await running;
    });
    expect(result.current.pending).toBe(false);
    await act(() => result.current.run(second));
    expect(second).toHaveBeenCalledOnce();
  });

  it("unlocks when the task throws", async () => {
    const { result } = renderHook(() => useGuardedSubmit(() => {}));
    await act(() => result.current.run(() => Promise.reject(new Error("no"))).catch(() => {}));
    expect(result.current.pending).toBe(false);
  });

  it("holds the lock after a navigation, and recovers when it stalls", async () => {
    vi.useFakeTimers();
    const onStall = vi.fn();
    const { result } = renderHook(() => useGuardedSubmit(onStall));

    await act(() => result.current.run(async () => NAVIGATED));
    expect(result.current.pending).toBe(true);
    expect(onStall).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(ASYNC_DEADLINES.userAction));
    expect(onStall).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(false);
  });
});
