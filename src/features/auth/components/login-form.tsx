"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/lib/async/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
import { AuthPanel } from "./auth-panel";
import { authInputClassName } from "./auth-styles";
import { AuthSubmitButton } from "./auth-submit-button";
import { GoogleOAuthButton } from "./google-oauth-button";

export function LoginForm({
  className,
  nextPath = "/portal",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setError("You are signed in, but the next page did not load. Try again.");
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    let navigationStarted = false;

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await withDeadline(
        () =>
          supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          }),
        { operation: "Sign in" },
      );

      if (error) throw error;

      router.replace(nextPath);
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      setError(getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.signIn));
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthPanel
      title="Sign in"
      description="Continue to the UBC UX Hub Portal with:"
      className={className}
      {...props}
    >
      <GoogleOAuthButton nextPath={nextPath} />

      <form onSubmit={handleLogin} className="space-y-6">
        <Field>
          <FieldLabel htmlFor="email" className="text-body text-foreground">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClassName}
          />
        </Field>

        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="password" className="text-body text-foreground">
              Password
            </FieldLabel>
            <Link
              href="/auth/forgot-password"
              className="text-body text-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClassName}
          />
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </AuthSubmitButton>

        <p className="text-center text-body text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
