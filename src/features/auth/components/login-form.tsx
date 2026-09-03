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
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      router.replace(nextPath);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
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
