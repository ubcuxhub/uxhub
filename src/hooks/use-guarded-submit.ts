"use client";

import { useCallback, useRef, useState } from "react";

import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";

/** What a task returns once it has started a navigation away from the form. */
export const NAVIGATED = "navigated";

/**
 * One submission at a time, with a pending flag for the button. `run(task)`
 * ignores a call while another is in flight. When the task resolves to
 * `NAVIGATED` the lock holds, so the form can't be resubmitted while the next
 * page loads; if that navigation never commits, `onStall` runs and the form
 * unlocks (`useNavigationRecovery`). Otherwise, success or throw, it unlocks
 * when the task settles.
 */
export function useGuardedSubmit(onStall: () => void) {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);
  const recover = useNavigationRecovery(() => {
    lockRef.current = false;
    setPending(false);
    onStall();
  });

  const run = useCallback(
    async (task: () => Promise<typeof NAVIGATED | void>) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setPending(true);
      let navigated = false;

      try {
        navigated = (await task()) === NAVIGATED;
        if (navigated) recover();
      } finally {
        if (!navigated) {
          lockRef.current = false;
          setPending(false);
        }
      }
    },
    [recover],
  );

  return { pending, run };
}
