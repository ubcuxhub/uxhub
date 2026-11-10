"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  INVALID_CREDENTIALS_MESSAGE,
  getAuthActionErrorMessage,
  isEmailNotConfirmedError,
  isInvalidCredentialsError,
} from "../auth-errors";
import {
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  setPendingEmail,
  subscribePendingEmail,
} from "../pending-email";
import { AuthPanel } from "./AuthPanel";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { GoogleOAuthButton } from "./GoogleOAuthButton";

export function LoginForm({
  className,
  nextPath = "/portal",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { nextPath?: string }) {
  // Sign up hands over the address typed there; until the user edits the
  // field, that address is its value.
  const carriedEmail = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? carriedEmail;
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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
    setPasswordError(null);
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
      if (isEmailNotConfirmedError(error)) {
        // Unverified accounts always go through Verify email before anything
        // else; the address travels out of band, as after sign-up.
        setPendingEmail(email.trim().toLowerCase());
        router.push(`/auth/verify-email?next=${encodeURIComponent(nextPath)}`);
        navigationStarted = true;
        recoverStalledNavigation();
      } else if (isInvalidCredentialsError(error)) {
        setPasswordError(INVALID_CREDENTIALS_MESSAGE);
      } else {
        setError(getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.signIn));
      }
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
      description="Sign in to the UBC UX Hub Portal."
      className={className}
      {...props}
    >
      <div className="flex flex-col gap-6">
      <GoogleOAuthButton nextPath={nextPath} dividerLabel="or sign in with email" />

      <form onSubmit={handleLogin} className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="email">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field data-invalid={passwordError ? true : undefined}>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="password">
              Password
            </FieldLabel>
            <Link
              href="/auth/forgot-password"
              onClick={() => {
                // Carry the typed address over so Forgot password starts filled.
                if (email.trim()) setPendingEmail(email.trim().toLowerCase());
              }}
              className="text-body text-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            aria-invalid={passwordError ? true : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError ? <FieldError>{passwordError}</FieldError> : null}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" loading={isLoading}>
          Sign in
        </AuthSubmitButton>

        <p className="text-body text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}
            className="text-foreground underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </form>
      </div>
    </AuthPanel>
  );
}
