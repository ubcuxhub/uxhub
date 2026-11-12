"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  getAuthActionErrorMessage,
} from "../auth-errors";
import {
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT_ERROR,
  isPasswordLongEnough,
} from "../password-rules";
import { AuthPanel } from "./AuthPanel";
import { AuthSubmitButton } from "./AuthSubmitButton";

export function UpdatePasswordForm({
  email,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  /** The account being recovered, from the recovery session. */
  email?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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

    setError(null);

    if (!isPasswordLongEnough(password)) {
      setPasswordError(PASSWORD_TOO_SHORT_ERROR);
      return;
    }
    setPasswordError(null);

    const supabase = createClient();
    submittingRef.current = true;
    setIsLoading(true);
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
      if ((error as { code?: unknown } | null)?.code === "weak_password") {
        setPasswordError(PASSWORD_TOO_SHORT_ERROR);
      } else {
        setError(
          getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.passwordUpdate),
        );
      }
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  return (
    <AuthPanel
      title="Set a new password"
      description={
        <>
          Choose a new password for{" "}
          {email ? (
            <strong className="font-medium text-foreground">{email}</strong>
          ) : (
            "your account"
          )}
          . You&rsquo;ll be signed in once it&rsquo;s saved.
        </>
      }
      className={className}
      {...props}
    >
      <form onSubmit={handleUpdatePassword} className="flex flex-col gap-6">
        <Field data-invalid={passwordError ? true : undefined}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            aria-invalid={passwordError ? true : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError ? (
            <FieldError>{passwordError}</FieldError>
          ) : (
            <FieldDescription>{PASSWORD_HINT}</FieldDescription>
          )}
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" loading={isLoading}>
          Save password
        </AuthSubmitButton>
      </form>
    </AuthPanel>
  );
}
