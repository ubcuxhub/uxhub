"use client";

import { useEffect, useState } from "react";

import { toast } from "@/components/ui/toast";
import { withDeadline } from "@/lib/async/deadline";
import { NAVIGATED, useGuardedSubmit } from "@/hooks/use-guarded-submit";

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
  /** The address the email went to, named in the confirmation toast. */
  email: string;
}

export function ResendEmailButton({ onResend, email }: ResendEmailButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const { pending: isResending, run } = useGuardedSubmit(() =>
    setStatus(
      "You are signed in, but the next page did not load. Return to sign in and try again.",
    ),
  );

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

  const resend = async () => {
    setStatus(null);

    try {
      const result = await withDeadline(() => onResend(), {
        operation: "Email resend",
      });
      if (result === "navigating") return NAVIGATED;
      toast.success(`Email sent to ${email}`, { id: "auth-email-sent" });
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
    }
  };

  const handleResend = () => {
    if (cooldownSeconds !== null) return;
    void run(resend);
  };

  const isCoolingDown = cooldownSeconds !== null;

  return (
    <div>
      <p className="text-body text-muted-foreground">
        Didn&rsquo;t get an email?{" "}
        <button
          type="button"
          className="text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isResending || isCoolingDown}
          onClick={handleResend}
        >
          {isResending ? "Sending…" : "Resend email"}
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
    </div>
  );
}
