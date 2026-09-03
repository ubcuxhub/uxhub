"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

interface GoogleOAuthButtonProps {
  nextPath?: string;
}

export function GoogleOAuthButton({
  nextPath = "/portal",
}: GoogleOAuthButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleOAuth = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", nextPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full font-medium shadow-none"
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
