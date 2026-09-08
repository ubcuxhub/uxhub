"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/lib/async/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
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
  const submittingRef = useRef(false);
  const router = useRouter();
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setError(
      "Your password was updated, but the portal did not load. Try signing in with your new password.",
    );
  });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    let navigationStarted = false;

    try {
      const { error } = await withDeadline(
        () => supabase.auth.updateUser({ password }),
        { operation: "Password update" },
      );
      if (error) throw error;
      router.push("/portal");
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      setError(
        getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.passwordUpdate),
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
