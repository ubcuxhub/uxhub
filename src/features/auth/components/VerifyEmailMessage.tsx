"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { Hubbo } from "@/components/shared/Hubbo";
import { withDeadline } from "@/lib/async/deadline";
import { createClient } from "@/lib/supabase/client";

import { AuthMessage } from "./AuthMessage";
import { ResendEmailButton } from "./ResendEmailButton";
import {
  clearPendingEmail,
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  subscribePendingEmail,
} from "../pending-email";

export function VerifyEmailMessage({
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
      try {
        const {
          data: { session },
        } = await withDeadline(() => supabase.auth.getSession(), {
          operation: "Session check",
        });

        if (active && session?.user) {
          redirectAuthenticatedUser();
        }
      } catch {
        // The auth-state subscription and later focus checks remain available.
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

  const handleResend = async (): Promise<"navigating" | void> => {
    const {
      data: { session },
    } = await withDeadline(() => supabase.auth.getSession(), {
      operation: "Session check",
    });

    if (session?.user) {
      redirectAuthenticatedUser();
      return "navigating";
    }

    const { error } = await withDeadline(
      () =>
        supabase.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        }),
      { operation: "Confirmation email resend" },
    );

    if (error) throw error;
  };

  return (
    <AuthMessage
      title="Check your email"
      illustration={<Hubbo emotion="welcoming" size="hero" className="h-50" />}
      description={
        <>
          We sent a verification link to{" "}
          {email ? (
            <strong className="font-medium text-foreground">{email}</strong>
          ) : (
            "your email address"
          )}
          . Open it to confirm your email and set up your profile.
        </>
      }
      backLink={{ href: "/auth/login", label: "Back to sign in" }}
    >
      {email ? <ResendEmailButton email={email} onResend={handleResend} /> : null}
    </AuthMessage>
  );
}
