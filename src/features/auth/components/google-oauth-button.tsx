"use client";

import { useRef, useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/lib/async/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";

interface GoogleOAuthButtonProps {
  nextPath?: string;
}

export function GoogleOAuthButton({
  nextPath = "/portal",
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
    <div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full font-medium shadow-none sm:h-10"
        disabled={isLoading}
        onClick={handleGoogleOAuth}
      >
        <FcGoogle className="size-5" />
        {isLoading ? "Redirecting..." : "Continue with Google"}
      </Button>

      {error ? <FieldError className="mt-3">{error}</FieldError> : null}

      {/* The provider set must stay identical on login and sign-up: with OAuth
          the same button both creates and signs in to an account. */}
      <p className="my-6 text-center text-body text-muted-foreground">
        or continue with email
      </p>
    </div>
  );
}
