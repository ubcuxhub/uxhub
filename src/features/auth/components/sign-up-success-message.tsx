"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { AuthMessage } from "./auth-message";
import { ResendEmailButton } from "./resend-email-button";
import {
  clearPendingEmail,
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  subscribePendingEmail,
} from "../pending-email";

export function SignUpSuccessMessage({
  nextPath = "/portal",
}: {
  nextPath?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const redirectStarted = useRef(false);

  // Session storage is client-only, so the address arrives after hydration.
  const email = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );

  const redirectAuthenticatedUser = useCallback(() => {
    if (redirectStarted.current) return;

    redirectStarted.current = true;
    clearPendingEmail();
    router.replace(nextPath);
  }, [nextPath, router]);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && session?.user) {
        redirectAuthenticatedUser();
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        redirectAuthenticatedUser();
      }
    });

    const checkVisibleSession = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };

    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkVisibleSession);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", checkVisibleSession);
    };
  }, [redirectAuthenticatedUser, supabase]);

  const handleResend = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      redirectAuthenticatedUser();
      return;
    }

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
