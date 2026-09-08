"use client";

import { useEffect, useState } from "react";

import {
  getRemainingCooldownSeconds,
  getResendCooldownMessage,
  getResendCooldownSeconds,
} from "../resend-email-cooldown";

interface ResendEmailButtonProps {
  /** Performs the resend; throwing surfaces the message to the user. */
  onResend: () => Promise<void>;
}

export function ResendEmailButton({ onResend }: ResendEmailButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

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
    setIsResending(true);
    setStatus(null);

    try {
      await onResend();
      setStatus("Email resent.");
    } catch (error: unknown) {
      const retryAfterSeconds = getResendCooldownSeconds(error);

      if (retryAfterSeconds !== null) {
        if (retryAfterSeconds > 0) {
          const now = Date.now();
          setCooldownEndsAt(now + retryAfterSeconds * 1000);
          setCooldownSeconds(retryAfterSeconds);
        }
      } else {
        setStatus(
          error instanceof Error ? error.message : "Unable to resend email.",
        );
      }
    } finally {
      setIsResending(false);
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
