"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { authInputClassName } from "./auth-styles";
import { AuthSubmitButton } from "./auth-submit-button";
import { setPendingEmail } from "../pending-email";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      );

      if (error) throw error;

      // Handed to the confirmation screen out of band so the address stays out
      // of the URL, and with it browser history and referrers.
      setPendingEmail(normalizedEmail);

      router.push("/auth/check-email");
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

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" disabled={isLoading}>
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
