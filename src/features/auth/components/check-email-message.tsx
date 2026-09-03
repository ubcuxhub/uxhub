"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { readPendingEmail } from "../pending-email";

export function CheckEmailMessage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Session storage is client-only, so the address arrives after hydration.
  useEffect(() => {
    setEmail(readPendingEmail());
  }, []);

  const handleResend = async () => {
    if (!email) return;

    const supabase = createClient();
    setIsResending(true);
    setStatus(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

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
    <AuthPanel title="Check your email!">
      <div className="mx-auto flex max-w-[460px] flex-col items-center text-center">
        <p className="text-body leading-6 text-foreground">
          If an account exists for {email || "that email address"}, we&rsquo;ll
          send a password reset link with instructions to continue.
        </p>

        {email ? (
          <p className="mt-7 text-body text-muted-foreground">
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
        ) : null}

        {status ? (
          <p className="mt-3 text-small text-muted-foreground" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    </AuthPanel>
  );
}
