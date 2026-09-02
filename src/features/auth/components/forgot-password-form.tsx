"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { AuthSubmitButton } from "./auth-submit-button";

const authInputClassName =
  "h-10 rounded-md border-border bg-background text-body text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-focus";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const canSubmit = email.length > 0;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      );

      if (error) throw error;

      router.push(
        `/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`,
      );
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPanel
      title="Forgot password"
      description="Enter the email linked to your UBC UX Hub account and we’ll send you a password reset link."
      className={className}
      {...props}
    >
      <form onSubmit={handleForgotPassword} className="space-y-6">
        <Field className="gap-2">
          <FieldLabel htmlFor="email" className="text-body font-normal text-foreground">
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

        {error ? (
          <p className="text-small text-destructive" aria-live="polite">
            {error}
          </p>
        ) : null}

        <AuthSubmitButton type="submit" disabled={!canSubmit || isLoading}>
          {isLoading ? "Sending..." : "Send reset link"}
        </AuthSubmitButton>

        <p className="text-center text-body text-muted-foreground">
          Remember your account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to log in
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}