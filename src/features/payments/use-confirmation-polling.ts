"use client";

import { useEffect, useState } from "react";

import { ASYNC_DEADLINES } from "@/lib/async/deadline";

const POLL_INTERVAL_MS = 3_000;

export function useConfirmationPolling(
  pending: boolean,
  refresh: () => void,
) {
  const [cutoffReached, setCutoffReached] = useState(false);

  useEffect(() => {
    if (!pending) return;

    const refreshInterval = window.setInterval(refresh, POLL_INTERVAL_MS);
    const cutoff = window.setTimeout(() => {
      window.clearInterval(refreshInterval);
      setCutoffReached(true);
    }, ASYNC_DEADLINES.confirmationPolling);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearTimeout(cutoff);
    };
  }, [pending, refresh]);

  return pending && cutoffReached;
}
