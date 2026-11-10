"use client";

import { useSyncExternalStore } from "react";

import { Hubbo } from "@/components/shared/Hubbo";
import { withDeadline } from "@/lib/async/deadline";
import { createClient } from "@/lib/supabase/client";

import { AuthMessage } from "./AuthMessage";
import { ResendEmailButton } from "./ResendEmailButton";
import {
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  subscribePendingEmail,
} from "../pending-email";

export function CheckEmailMessage() {
  // Session storage is client-only, so the address arrives after hydration.
  const email = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );

  const handleResend = async () => {
    const supabase = createClient();

    const { error } = await withDeadline(
      () =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
        }),
      { operation: "Password reset email resend" },
    );

    if (error) throw error;
  };

  return (
    <AuthMessage
      title="Check your email"
      illustration={<Hubbo emotion="welcoming" size="hero" className="h-50" />}
      description={
        <>
          If an account exists for{" "}
          {email ? (
            <strong className="font-medium text-foreground">{email}</strong>
          ) : (
            "that email address"
          )}
          , we&rsquo;ll send a password reset link with instructions to continue.
        </>
      }
      backLink={{ href: "/auth/login", label: "Back to sign in" }}
    >
      {email ? <ResendEmailButton email={email} onResend={handleResend} /> : null}
    </AuthMessage>
  );
}
