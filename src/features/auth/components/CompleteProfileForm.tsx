"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Hubbo } from "@/components/shared/Hubbo";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import { completeProfileAction } from "../actions";
import { AuthPanel } from "./AuthPanel";
import { AuthSubmitButton } from "./AuthSubmitButton";

type NameField = "firstName" | "lastName";

const REQUIRED: Record<NameField, string> = {
  firstName: "Enter your first name.",
  lastName: "Enter your last name.",
};

const SAVE_FAILED = "We couldn't save your name. Please try again.";

/**
 * Asks a signed-in user for the names their sign-in provider didn't share
 * (a Google account with a one-word name, say), creates their profile, and
 * carries on to where they were going.
 */
export function CompleteProfileForm({
  nextPath = "/portal",
  email,
  defaultFirstName = "",
  defaultLastName = "",
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  nextPath?: string;
  /** The signed-in account, so "Use a different account" makes sense. */
  email?: string;
  defaultFirstName?: string;
  defaultLastName?: string;
}) {
  const [names, setNames] = useState<Record<NameField, string>>({
    firstName: defaultFirstName,
    lastName: defaultLastName,
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<NameField, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const submittingRef = useRef(false);
  const inputRefs = {
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
  };
  const router = useRouter();
  const recoverStalledNavigation = useNavigationRecovery(() => {
    submittingRef.current = false;
    setIsLoading(false);
    setIsSigningOut(false);
    setError("The next page did not load. Please try again.");
  });

  const busy = isLoading || isSigningOut;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    setError(null);

    const firstName = names.firstName.trim();
    const lastName = names.lastName.trim();
    const errors: Partial<Record<NameField, string>> = {};
    if (!firstName) errors.firstName = REQUIRED.firstName;
    if (!lastName) errors.lastName = REQUIRED.lastName;
    setFieldErrors(errors);

    const firstInvalid = (Object.keys(errors) as NameField[])[0];
    if (firstInvalid) {
      inputRefs[firstInvalid].current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    let navigationStarted = false;

    try {
      const result = await withDeadline(
        () => completeProfileAction({ firstName, lastName }),
        { operation: "Profile creation" },
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Replace, not push: Back shouldn't return to a form that's done.
      router.replace(nextPath);
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (error: unknown) {
      setError(
        isAsyncTimeoutError(error)
          ? getAsyncErrorMessage(error, SAVE_FAILED)
          : SAVE_FAILED,
      );
    } finally {
      if (!navigationStarted) {
        submittingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const handleUseDifferentAccount = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSigningOut(true);
    setError(null);
    const supabase = createClient();

    try {
      const { error } = await withDeadline(() => supabase.auth.signOut(), {
        operation: "Sign out",
      });
      if (error) throw error;
    } catch {
      // The remote revocation failed; still drop this browser's session so
      // the next sign-in starts clean.
      try {
        await withDeadline(() => supabase.auth.signOut({ scope: "local" }), {
          operation: "Local sign out",
        });
      } catch {
        // Login shows the account again if the session survived.
      }
    }

    router.replace(`/auth/login?next=${encodeURIComponent(nextPath)}`);
    recoverStalledNavigation();
  };

  const handleChange = (field: NameField, value: string) => {
    setNames((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const renderField = (
    field: NameField,
    id: string,
    label: string,
    autoComplete: string,
    placeholder: string,
  ) => (
    <Field data-invalid={fieldErrors[field] ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        ref={inputRefs[field]}
        id={id}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        aria-invalid={fieldErrors[field] ? true : undefined}
        value={names[field]}
        onChange={(e) => handleChange(field, e.target.value)}
      />
      {fieldErrors[field] ? (
        <FieldError>{fieldErrors[field]}</FieldError>
      ) : null}
    </Field>
  );

  return (
    <AuthPanel
      title="What should we call you?"
      description="Google didn't share your full name with us. We'll use it on your tickets and membership."
      illustration={<Hubbo emotion="welcoming" size="hero" className="h-50" />}
      className={className}
      {...props}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {renderField("firstName", "first-name", "First name", "given-name", "First")}
          {renderField("lastName", "last-name", "Last name", "family-name", "Last")}
        </div>

        {error ? <FieldError>{error}</FieldError> : null}

        <AuthSubmitButton type="submit" loading={isLoading} disabled={busy}>
          Continue
        </AuthSubmitButton>

        <p className="text-body text-muted-foreground">
          {email ? (
            <>
              Signed in as{" "}
              <strong className="font-medium text-foreground">{email}</strong>.{" "}
            </>
          ) : null}
          <button
            type="button"
            onClick={handleUseDifferentAccount}
            disabled={busy}
            className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-default disabled:text-muted-foreground"
          >
            Use a different account
          </button>
        </p>
      </form>
    </AuthPanel>
  );
}
