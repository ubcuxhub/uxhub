"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";

interface CheckEmailMessageProps {
  email: string;
}

export function CheckEmailMessage({ email }: CheckEmailMessageProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleResend = async () => {
    if (!normalizedEmail) return;

    const supabase = createClient();
    setIsResending(true);
    setStatus(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      );

      if (error) throw error;

      setStatus("Email resent.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Unable to resend email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPanel className="py-16" title="Check your email!">
      <div className="mx-auto flex max-w-[460px] flex-col items-center text-center">
        <div className="mb-6 size-[180px] bg-muted" aria-hidden="true" />

        <p className="text-body leading-6 text-foreground">
          If an account exists for {normalizedEmail || "that email address"},
          we’ll send a password reset link with instructions to continue.
        </p>

        <p className="mt-7 text-body text-muted-foreground">
          Didn&apos;t receive an email?{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!normalizedEmail || isResending}
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
      </div>
    </AuthPanel>
  );
}