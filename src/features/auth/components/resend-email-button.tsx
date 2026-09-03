"use client";

import { useState } from "react";

interface ResendEmailButtonProps {
  /** Performs the resend; throwing surfaces the message to the user. */
  onResend: () => Promise<void>;
}

export function ResendEmailButton({ onResend }: ResendEmailButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    setStatus(null);

    try {
      await onResend();
      setStatus("Email resent.");
    } catch (error: unknown) {
      setStatus(
        error instanceof Error ? error.message : "Unable to resend email.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <p className="text-body text-muted-foreground">
        Didn&apos;t receive an email?{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isResending}
          onClick={handleResend}
        >
          {isResending ? "Resending..." : "Resend email"}
        </button>
      </p>

      {status ? (
        <p className="mt-3 text-small text-muted-foreground" aria-live="polite">
          {status}
        </p>
      ) : null}
    </>
  );
}
