"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { Hubbo } from "@/components/shared/Hubbo";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { withDeadline } from "@/lib/async/deadline";
import { useNavigationRecovery } from "@/hooks/use-navigation-recovery";
import { createClient } from "@/lib/supabase/client";

import {
  AUTH_ACTION_ERRORS,
  INVALID_EMAIL_MESSAGE,
  getAuthActionErrorMessage,
  isPlausibleEmail,
} from "../auth-errors";
import type { ExpiredLinkType } from "../link-expired";
import {
  getPendingEmailServerSnapshot,
  getPendingEmailSnapshot,
  setPendingEmail,
  subscribePendingEmail,
} from "../pending-email";
import {
  getResendCooldownMessage,
  getResendCooldownSeconds,
} from "../resend-email-cooldown";
import { AuthMessage } from "./AuthMessage";

const COPY: Record<ExpiredLinkType, { lead: string; destination: string }> = {
  verify: {
    lead: "Verification links only work for a short time.",
    destination: "/auth/verify-email",
  },
  reset: {
    lead: "Reset links only work for a short time.",
    destination: "/auth/check-email",
  },
};

/**
 * Shown when a confirmation or recovery link can no longer be used. The
 * address is only known in the browser that asked for the email (session
 * storage); anywhere else the screen asks for it.
 */
export function LinkExpiredMessage({
  type,
  nextPath = "/portal",
}: {
  type: ExpiredLinkType;
  nextPath?: string;
}) {
  const router = useRouter();
  const pendingEmail = useSyncExternalStore(
    subscribePendingEmail,
    getPendingEmailSnapshot,
    getPendingEmailServerSnapshot,
  );
  const [typedEmail, setTypedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const recoverStalledNavigation = useNavigationRecovery(() => {
    sendingRef.current = false;
    setIsSending(false);
    setError("The email was sent, but the next page did not load. Check your inbox.");
  });

  const knownEmail = pendingEmail;
  const email = (knownEmail || typedEmail).trim().toLowerCase();
  const { lead, destination } = COPY[type];

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendingRef.current) return;

    if (!isPlausibleEmail(email)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    setError(null);
    let navigationStarted = false;

    try {
      const supabase = createClient();
      const callback = `${window.location.origin}/auth/callback`;

      const { error: sendError } = await withDeadline(
        async () => {
          if (type === "verify") {
            const { error } = await supabase.auth.resend({
              type: "signup",
              email,
              options: {
                emailRedirectTo: `${callback}?next=${encodeURIComponent(nextPath)}`,
              },
            });
            return { error };
          }
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${callback}?next=${encodeURIComponent("/auth/update-password")}`,
          });
          return { error };
        },
        { operation: "Link resend" },
      );

      if (sendError) throw sendError;

      setPendingEmail(email);
      router.push(
        type === "verify"
          ? `${destination}?next=${encodeURIComponent(nextPath)}`
          : destination,
      );
      navigationStarted = true;
      recoverStalledNavigation();
    } catch (sendError: unknown) {
      const cooldown = getResendCooldownSeconds(sendError);
      setError(
        cooldown !== null
          ? getResendCooldownMessage(cooldown)
          : getAuthActionErrorMessage(sendError, AUTH_ACTION_ERRORS.resend),
      );
    } finally {
      if (!navigationStarted) {
        sendingRef.current = false;
        setIsSending(false);
      }
    }
  };

  return (
    <AuthMessage
      title="This link has expired"
      illustration={<Hubbo emotion="thinking" size="hero" className="h-50" />}
      description={
        knownEmail ? (
          <>
            {lead} Send a new one to{" "}
            <strong className="font-medium text-foreground">{knownEmail}</strong>
            .
          </>
        ) : (
          <>{lead} Enter your email and we&rsquo;ll send a new one.</>
        )
      }
    >
      <form onSubmit={handleSend} noValidate className="flex w-full flex-col gap-3">
        {knownEmail ? null : (
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              aria-invalid={error ? true : undefined}
              value={typedEmail}
              onChange={(event) => setTypedEmail(event.target.value)}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        )}

        {knownEmail && error ? <FieldError>{error}</FieldError> : null}

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
        <Button type="submit" className="w-full" loading={isSending}>
          Send new link
        </Button>
      </form>
    </AuthMessage>
  );
}
