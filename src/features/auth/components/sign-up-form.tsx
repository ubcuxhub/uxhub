"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { AuthSubmitButton } from "./auth-submit-button";

type SignUpFormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  repeatPassword: string;
};

const authInputClassName =
  "h-10 rounded-md border-border bg-white text-body text-fg shadow-none placeholder:text-fg-muted focus-visible:ring-focus";

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fullName =
    `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

  const canSubmit =
    formData.firstName.length > 0 &&
    formData.lastName.length > 0 &&
    formData.email.length > 0 &&
    formData.password.length >= 8 &&
    formData.repeatPassword.length > 0 &&
    formData.password === formData.repeatPassword;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (formData.password !== formData.repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            nextPath,
          )}`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error("User not returned from Supabase");

      if (authData.session) {
        const res = await fetch("/api/auth/complete-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          console.error("Failed to create user profile:", result.error);
          throw new Error(result.error || "Failed to create user profile");
        }
      }

      router.push(`/auth/sign-up-success?next=${encodeURIComponent(nextPath)}`);
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
      density="compact"
      className={className}
      {...props}
    >
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="first-name" className="text-body text-fg">
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
            <FieldLabel htmlFor="last-name" className="text-body text-fg">
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
          <FieldLabel htmlFor="email" className="text-body text-fg">
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

        <Field>
          <FieldLabel htmlFor="password" className="text-body text-fg">
            Password *
          </FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            required
            minLength={8}
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            className={authInputClassName}
          />
          <FieldDescription className="text-body text-fg-secondary">
            Password must be at least 8 characters.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="repeat-password" className="text-body text-fg">
            Confirm password *
          </FieldLabel>
          <Input
            id="repeat-password"
            type="password"
            placeholder="Re-enter your password"
            required
            value={formData.repeatPassword}
            onChange={(e) => handleChange("repeatPassword", e.target.value)}
            className={authInputClassName}
          />
        </Field>

        {error ? (
          <p className="text-small text-destructive" aria-live="polite">
            {error}
          </p>
        ) : null}

        <AuthSubmitButton type="submit" disabled={!canSubmit || isLoading}>
          {isLoading ? "Creating account..." : "Complete sign up"}
        </AuthSubmitButton>

        <p className="text-center text-body text-fg-secondary">
          Already have an account?{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-fg underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}