"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { withDeadline } from "@/lib/async/deadline";
import { NAVIGATED, useGuardedSubmit } from "@/hooks/use-guarded-submit";
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
  const { pending: isLoading, run } = useGuardedSubmit(() =>
    setError(
      "Google sign-in did not redirect. Check your connection and try again.",
    ),
  );

  const signInWithGoogle = async () => {
    const supabase = createClient();
    setError(null);

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
      return NAVIGATED;
    } catch (error: unknown) {
      setError(getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.google));
    }
  };

  const handleGoogleOAuth = () => void run(signInWithGoogle);

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
