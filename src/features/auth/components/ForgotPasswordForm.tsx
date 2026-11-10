"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  INVALID_EMAIL_MESSAGE,
  getAuthActionErrorMessage,
  isPlausibleEmail,
} from "../auth-errors";
import {
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  setPendingEmail,
  subscribePendingEmail,
} from "../pending-email";
import { AuthPanel } from "./AuthPanel";
import { AuthSubmitButton } from "./AuthSubmitButton";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  // Sign in hands over the address typed there; until the user edits the
  // field, that address is its value.
  const carriedEmail = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? carriedEmail;
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setError(
      "The reset email was requested, but the next page did not load. Check your inbox before trying again.",
    );
  });

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    if (!isPlausibleEmail(email)) {
      setError(null);
      setEmailError(INVALID_EMAIL_MESSAGE);
      return;
    }
    setEmailError(null);

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    let navigationStarted = false;

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await withDeadline(
        () =>
          supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
          }),
        { operation: "Password reset email" },
      );

      if (error) throw error;

      // Handed to the confirmation screen out of band so the address stays out
      // of the URL, and with it browser history and referrers.
      setPendingEmail(normalizedEmail);

      router.push("/auth/check-email");
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      setError(
        isAsyncTimeoutError(error)
          ? "We could not confirm whether the reset email was sent. Check your inbox before requesting another."
          : getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.passwordReset),
      );
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthPanel
      title="Forgot password"
      description="Enter the email linked to your UBC UX Hub account and we’ll send you a password reset link."
      className={className}
      {...props}
    >
      <form
        onSubmit={handleForgotPassword}
        noValidate
        className="flex flex-col gap-6"
      >
        <Field data-invalid={emailError ? true : undefined}>
          <FieldLabel htmlFor="email">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={emailError ? true : undefined}
            value={email}
            onChange={(e) => {
              setTypedEmail(e.target.value);
              setEmailError(null);
            }}
          />
          {emailError ? <FieldError>{emailError}</FieldError> : null}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" loading={isLoading}>
          Send reset link
        </AuthSubmitButton>

        <p className="text-body text-muted-foreground">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
