"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
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
        className="h-9 w-full rounded-md bg-background text-body font-medium text-foreground shadow-none"
        disabled={isLoading}
        onClick={handleGoogleOAuth}
      >
        <FcGoogle className="size-5" />
        {isLoading ? "Redirecting..." : "Continue with Google"}
      </Button>

      {error ? (
        <p className="mt-3 text-small text-destructive" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}