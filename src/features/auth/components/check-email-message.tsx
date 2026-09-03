"use client";

import { useSyncExternalStore } from "react";

import { createClient } from "@/lib/supabase/client";

import { AuthMessage } from "./auth-message";
import { ResendEmailButton } from "./resend-email-button";
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) throw error;
  };

  return (
    <AuthMessage
      title="Check your email!"
      action={email ? <ResendEmailButton onResend={handleResend} /> : null}
      backLink={{ href: "/auth/login", label: "Back to log in" }}
    >
      If an account exists for {email || "that email address"}, we&rsquo;ll send
      a password reset link with instructions to continue.
    </AuthMessage>
  );
}
