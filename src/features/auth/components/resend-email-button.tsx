"use client";

import { useEffect, useRef, useState } from "react";

import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/lib/async/use-navigation-recovery";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
import {
  getRemainingCooldownSeconds,
  getResendCooldownMessage,
  getResendCooldownSeconds,
} from "../resend-email-cooldown";

interface ResendEmailButtonProps {
  /** Performs the resend; throwing surfaces the message to the user. */
  onResend: () => Promise<"navigating" | void>;
}

export function ResendEmailButton({ onResend }: ResendEmailButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const resendingRef = useRef(false);
  const recoverStalledNavigation = useNavigationRecovery(() => {
    resendingRef.current = false;
    setIsResending(false);
    setStatus(
      "You are signed in, but the next page did not load. Return to sign in and try again.",
    );
  });

  useEffect(() => {
    if (cooldownEndsAt === null) return;

    const updateCooldown = () => {
      const remaining = getRemainingCooldownSeconds(
        cooldownEndsAt,
        Date.now(),
      );

      if (remaining === 0) {
        setCooldownEndsAt(null);
        setCooldownSeconds(null);
        return;
      }

      setCooldownSeconds(remaining);
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 1000);

    return () => window.clearInterval(interval);
  }, [cooldownEndsAt]);

  const handleResend = async () => {
    if (resendingRef.current || cooldownSeconds !== null) return;

    resendingRef.current = true;
    setIsResending(true);
    setStatus(null);
    let navigationStarted = false;

    try {
      const result = await withDeadline(() => onResend(), {
        operation: "Email resend",
      });
      navigationStarted = result === "navigating";
      if (navigationStarted) recoverStalledNavigation();
      else setStatus("Email resent.");
    } catch (error: unknown) {
      const retryAfterSeconds = getResendCooldownSeconds(error);

      if (retryAfterSeconds !== null) {
        if (retryAfterSeconds > 0) {
          const now = Date.now();
          setCooldownEndsAt(now + retryAfterSeconds * 1000);
          setCooldownSeconds(retryAfterSeconds);
        }
      } else {
        setStatus(getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.resend));
      }
    } finally {
      if (!navigationStarted) {
        resendingRef.current = false;
        setIsResending(false);
      }
    }
  };

  const isCoolingDown = cooldownSeconds !== null;

  return (
    <>
      <p className="text-body text-muted-foreground">
        Didn&apos;t receive an email?{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isResending || isCoolingDown}
          onClick={handleResend}
        >
          {isResending ? "Resending..." : "Resend email"}
        </button>
      </p>

      {isCoolingDown ? (
        <p className="mt-3 text-small text-muted-foreground">
          {getResendCooldownMessage(cooldownSeconds)}
        </p>
      ) : status ? (
        <p className="mt-3 text-small text-muted-foreground" aria-live="polite">
          {status}
        </p>
      ) : null}
    </>
  );
}
