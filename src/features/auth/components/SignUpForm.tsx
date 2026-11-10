"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import { completeProfileAction } from "../actions";
import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
import { setPendingEmail } from "../pending-email";
import {
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT_ERROR,
  isPasswordLongEnough,
} from "../password-rules";
import { AuthPanel } from "./AuthPanel";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { GoogleOAuthButton } from "./GoogleOAuthButton";

type SignUpFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type SignUpFieldErrors = Partial<Record<"password", string>>;

export function SignUpForm({
  className,
  nextPath = "/portal",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { nextPath?: string }) {
  const [formData, setFormData] = useState<SignUpFormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setError(
      "Your account was created, but the next page did not load. Check your email or try signing in.",
    );
  });

  // Validated on submit rather than gating the button, so a failing rule names
  // itself on the field it belongs to instead of leaving a dead control.
  const validate = (): SignUpFieldErrors => {
    const errors: SignUpFieldErrors = {};

    if (!isPasswordLongEnough(formData.password)) {
      errors.password = PASSWORD_TOO_SHORT_ERROR;
    }

    return errors;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setError(null);

    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
    let navigationStarted = false;

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();

      const { data: authData, error: authError } = await withDeadline(
        () =>
          supabase.auth.signUp({
            email: normalizedEmail,
            password: formData.password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
              data: {
                first_name: formData.firstName.trim(),
                last_name: formData.lastName.trim(),
              },
            },
          }),
        { operation: "Account creation" },
      );

      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error("User not returned from Supabase");

      // When email confirmation is disabled, signUp returns a session and the
      // profile can be created immediately. Otherwise the confirmation
      // callback creates it once the session exists.
      if (authData.session) {
        const result = await withDeadline(
          () =>
            completeProfileAction({
              firstName: formData.firstName.trim(),
              lastName: formData.lastName.trim(),
            }),
          { operation: "Profile creation" },
        );

        if (!result.ok) throw new Error(result.error);
      }

      // Handed to the confirmation screen out of band so the address stays out
      // of the URL, and with it browser history and referrers.
      setPendingEmail(normalizedEmail);

      router.push(
        `/auth/verify-email?next=${encodeURIComponent(nextPath)}`,
      );
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      if ((error as { code?: unknown } | null)?.code === "weak_password") {
        setFieldErrors({ password: PASSWORD_TOO_SHORT_ERROR });
      } else setError(
        isAsyncTimeoutError(error)
          ? "We could not confirm whether your account was created. Check your email or try signing in before submitting again."
          : getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.signUp),
      );
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const handleChange = (field: keyof SignUpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AuthPanel
      title="Sign up"
      description="Create your UX Hub account to register for workshops, socials and UXathon."
      className={className}
      {...props}
    >
      <div className="flex flex-col gap-6">
      <GoogleOAuthButton nextPath={nextPath} dividerLabel="or sign up with email" />

      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="first-name">
              First name
            </FieldLabel>
            <Input
              id="first-name"
              placeholder="First"
              autoComplete="given-name"
              required
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="last-name">
              Last name
            </FieldLabel>
            <Input
              id="last-name"
              placeholder="Last"
              autoComplete="family-name"
              required
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
            />
          </Field>
        </div>

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
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
        </Field>

        <Field data-invalid={fieldErrors.password ? true : undefined}>
          <FieldLabel htmlFor="password">
            Password
          </FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            aria-invalid={fieldErrors.password ? true : undefined}
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
          />
          {fieldErrors.password ? (
            <FieldError>{fieldErrors.password}</FieldError>
          ) : (
            <FieldDescription>{PASSWORD_HINT}</FieldDescription>
          )}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" loading={isLoading}>
          Create account
        </AuthSubmitButton>

        <p className="text-body text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
      </div>
    </AuthPanel>
  );
}
