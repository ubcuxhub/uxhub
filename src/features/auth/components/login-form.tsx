"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { AuthSubmitButton } from "./auth-submit-button";
import { GoogleOAuthButton } from "./google-oauth-button";

const authInputClassName =
  "h-10 rounded-md border-border bg-white text-body text-fg shadow-none placeholder:text-fg-muted focus-visible:ring-focus";

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

  const canSubmit = email.length > 0 && password.length > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

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

      <div className="my-6 text-center text-body text-fg-secondary">
        or continue with email
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <Field>
          <FieldLabel htmlFor="email" className="text-body text-fg">
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
            <FieldLabel htmlFor="password" className="text-body text-fg">
              Password
            </FieldLabel>
            <Link
              href="/auth/forgot-password"
              className="text-body text-fg underline-offset-4 hover:underline"
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

        {error ? (
          <p className="text-small text-destructive" aria-live="polite">
            {error}
          </p>
        ) : null}

        <AuthSubmitButton type="submit" disabled={!canSubmit || isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </AuthSubmitButton>

        <p className="text-center text-body text-fg-secondary">
          Don&apos;t have an account?{" "}
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-fg underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthPanel>
  );
}
