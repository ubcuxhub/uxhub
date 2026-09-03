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

export function SignUpSuccessMessage({
  nextPath = "/portal",
}: {
  nextPath?: string;
}) {
  // Session storage is client-only, so the address arrives after hydration.
  const email = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );

  const handleResend = async () => {
    const supabase = createClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) throw error;
  };

  return (
    <AuthMessage
      title="Thank you for signing up!"
      action={email ? <ResendEmailButton onResend={handleResend} /> : null}
      backLink={{ href: "/auth/login", label: "Back to log in" }}
    >
      We&rsquo;ve sent a confirmation link to {email || "your email address"}.
      Confirm your account to finish signing up.
    </AuthMessage>
  );
}
