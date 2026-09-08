"use client";

import { useCallback, useEffect, useRef } from "react";

import { ASYNC_DEADLINES } from "./deadline";

/**
 * Keeps a successful mutation locked while navigation starts, but restores
 * the current screen if that navigation never commits. Unmounting cancels the
 * fallback naturally.
 */
export function useNavigationRecovery(
  onNavigationTimeout: () => void,
  timeoutMs = ASYNC_DEADLINES.userAction,
) {
  const callbackRef = useRef(onNavigationTimeout);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onNavigationTimeout;
  }, [onNavigationTimeout]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      callbackRef.current();
    }, timeoutMs);
  }, [timeoutMs]);
}
