"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { withDeadline } from "@/lib/async/deadline";
import { NAVIGATED, useGuardedSubmit } from "@/hooks/use-guarded-submit";
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
  const router = useRouter();
  const { pending: isLoading, run } = useGuardedSubmit(() =>
    setError(
      "Your password was updated, but the portal did not load. Try signing in with your new password.",
    ),
  );

  const updatePassword = async () => {
    const supabase = createClient();

    try {
      const { error } = await withDeadline(
        () => supabase.auth.updateUser({ password }),
        { operation: "Password update" },
      );
      if (error) throw error;
      router.push("/portal");
      return NAVIGATED;
    } catch (error: unknown) {
      if ((error as { code?: unknown } | null)?.code === "weak_password") {
        setPasswordError(PASSWORD_TOO_SHORT_ERROR);
      } else {
        setError(
          getAuthActionErrorMessage(error, AUTH_ACTION_ERRORS.passwordUpdate),
        );
      }
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordLongEnough(password)) {
      setPasswordError(PASSWORD_TOO_SHORT_ERROR);
      return;
    }
    setPasswordError(null);

    void run(updatePassword);
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
