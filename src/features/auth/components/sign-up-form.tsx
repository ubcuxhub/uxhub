"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { authInputClassName } from "./auth-styles";
import { AuthSubmitButton } from "./auth-submit-button";
import { GoogleOAuthButton } from "./google-oauth-button";
import { setPendingEmail } from "../pending-email";

const MIN_PASSWORD_LENGTH = 8;

type SignUpFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  repeatPassword: string;
};

type SignUpFieldErrors = Partial<
  Record<"password" | "repeatPassword", string>
>;

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
    repeatPassword: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Validated on submit rather than gating the button, so a failing rule names
  // itself on the field it belongs to instead of leaving a dead control.
  const validate = (): SignUpFieldErrors => {
    const errors: SignUpFieldErrors = {};

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (formData.password !== formData.repeatPassword) {
      errors.repeatPassword = "Passwords do not match.";
    }

    return errors;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const supabase = createClient();
    setIsLoading(true);

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
          },
        },
      });

      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error("User not returned from Supabase");

      // When email confirmation is disabled, signUp returns a session and the
      // authenticated route can create the profile immediately. Otherwise the
      // confirmation callback creates it once the session exists.
      if (authData.session) {
        const res = await fetch("/api/auth/complete-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          console.error("Failed to create user profile:", result.error);
          throw new Error(result.error || "Failed to create user profile");
        }
      }

      // Handed to the confirmation screen out of band so the address stays out
      // of the URL, and with it browser history and referrers.
      setPendingEmail(normalizedEmail);

      router.push(
        `/auth/sign-up-success?next=${encodeURIComponent(nextPath)}`,
      );
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof SignUpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AuthPanel
      title="Sign up"
      description="Create a new account."
      className={className}
      {...props}
    >
      <GoogleOAuthButton nextPath={nextPath} />

      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="first-name" className="text-body text-foreground">
              First Name *
            </FieldLabel>
            <Input
              id="first-name"
              placeholder="Enter your first name"
              required
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              className={authInputClassName}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="last-name" className="text-body text-foreground">
              Last Name *
            </FieldLabel>
            <Input
              id="last-name"
              placeholder="Enter your last name"
              required
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              className={authInputClassName}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="email" className="text-body text-foreground">
            Email *
          </FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            required
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={authInputClassName}
          />
        </Field>

        <Field data-invalid={fieldErrors.password ? true : undefined}>
          <FieldLabel htmlFor="password" className="text-body text-foreground">
            Password *
          </FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={fieldErrors.password ? true : undefined}
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            className={authInputClassName}
          />
          {fieldErrors.password ? (
            <FieldError>{fieldErrors.password}</FieldError>
          ) : (
            <FieldDescription className="text-body">
              Password must be at least {MIN_PASSWORD_LENGTH} characters.
            </FieldDescription>
          )}
        </Field>

        <Field data-invalid={fieldErrors.repeatPassword ? true : undefined}>
          <FieldLabel htmlFor="repeat-password" className="text-body text-foreground">
            Confirm password *
          </FieldLabel>
          <Input
            id="repeat-password"
            type="password"
            placeholder="Re-enter your password"
            required
            aria-invalid={fieldErrors.repeatPassword ? true : undefined}
            value={formData.repeatPassword}
            onChange={(e) => handleChange("repeatPassword", e.target.value)}
            className={authInputClassName}
          />
          {fieldErrors.repeatPassword ? (
            <FieldError>{fieldErrors.repeatPassword}</FieldError>
          ) : null}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Complete sign up"}
        </AuthSubmitButton>

        <p className="text-center text-body text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
