"use client";

import { useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
import { AuthDivider } from "./AuthDivider";

interface GoogleOAuthButtonProps {
  nextPath?: string;
  /** Label on the rule between Google and the email form. */
  dividerLabel: string;
}

export function GoogleOAuthButton({
  nextPath = "/portal",
  dividerLabel,
}: GoogleOAuthButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setError(
      "Google sign-in did not redirect. Check your connection and try again.",
    );
  });

  const handleGoogleOAuth = async () => {
    if (submittingRef.current) return;

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    let navigationStarted = false;

    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);

      const { error } = await withDeadline(
        () =>
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: redirectTo.toString(),
            },
          }),
        { operation: "Google sign in" },
      );

      if (error) throw error;
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      setError(getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.google));
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={isLoading}
        onClick={handleGoogleOAuth}
      >
        <FcGoogle />
        Continue with Google
      </Button>

      {error ? <FieldError className="-mt-3">{error}</FieldError> : null}

      {/* The provider set must stay identical on login and sign-up: with OAuth
          the same button both creates and signs in to an account. */}
      <AuthDivider>{dividerLabel}</AuthDivider>
    </div>
  );
}
