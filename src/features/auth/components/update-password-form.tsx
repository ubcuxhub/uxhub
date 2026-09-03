"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

import { AuthPanel } from "./auth-panel";
import { authInputClassName } from "./auth-styles";
import { AuthSubmitButton } from "./auth-submit-button";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/portal");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPanel
      title="Reset your password"
      description="Please enter your new password below."
      className={className}
      {...props}
    >
      <form onSubmit={handleUpdatePassword} className="space-y-6">
        <Field>
          <FieldLabel htmlFor="password" className="text-body text-foreground">
            New password
          </FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="Enter your new password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClassName}
          />
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save new password"}
        </AuthSubmitButton>
      </form>
    </AuthPanel>
  );
}
