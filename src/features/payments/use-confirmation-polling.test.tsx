// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";
import { useConfirmationPolling } from "./use-confirmation-polling";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useConfirmationPolling", () => {
  it("stops refreshing and exposes the cutoff state", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();

    function Harness() {
      const cutoffReached = useConfirmationPolling(true, refresh);
      return <span>{cutoffReached ? "still-processing" : "polling"}</span>;
    }

    render(<Harness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_DEADLINES.confirmationPolling);
    });

    expect(screen.getByText("still-processing")).toBeTruthy();
    const callsAtCutoff = refresh.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(refresh).toHaveBeenCalledTimes(callsAtCutoff);
  });
});
