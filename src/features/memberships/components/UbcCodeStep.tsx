"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRemainingCooldownSeconds } from "@/features/auth/resend-email-cooldown";
import {
  extractUbcCodeDigits,
  UBC_CODE_LENGTH,
  UBC_CODE_MAX_ATTEMPTS,
  type PendingUbcCode,
  type UbcSendResult,
  type UbcVerifyResult,
} from "@/features/memberships/lib/ubc-verification";

/**
 * The code state of the join details step for UBC students and faculty: the
 * 6-digit code we emailed to their UBC address, typed into the same dialog
 * step before tiers and payment. See docs/design/ubc-email-verification.md,
 * "Dialog UX".
 *
 * The server does the counting (attempts, cooldown, daily cap); this only
 * shows where things stand and keeps the clock for Resend and expiry.
 */

export interface UbcCodeClient {
  sendCode: () => Promise<UbcSendResult>;
  verifyCode: (code: string) => Promise<UbcVerifyResult>;
}

/** Where the step opens: right after a send, or on a code already pending. */
export type UbcCodeStart =
  | { kind: "send"; result: UbcSendResult }
  | { kind: "pending"; pending: PendingUbcCode };

export type UbcCodeStatus =
  | "code_sent"
  | "wrong"
  | "malformed"
  | "expired"
  | "locked"
  | "no_code"
  | "stale"
  | "daily_cap"
  | "taken"
  | "send_failed"
  | "error"
  | "verified";

export interface UbcCodeState {
  status: UbcCodeStatus;
  attemptsLeft: number | null;
  resendAt: number | null;
  expiresAt: number | null;
}

const toTime = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : null;

/** States in which the last code can't be used any more: a send comes first. */
const NEEDS_NEW_CODE = new Set<UbcCodeStatus>(["expired", "locked", "no_code", "send_failed"]);

export function stateAfterSend(result: UbcSendResult, previous: UbcCodeState | null): UbcCodeState {
  const base: UbcCodeState = previous ?? {
    status: "no_code",
    attemptsLeft: null,
    resendAt: null,
    expiresAt: null,
  };
  switch (result.status) {
    case "sent":
      return {
        status: "code_sent",
        attemptsLeft: UBC_CODE_MAX_ATTEMPTS,
        resendAt: toTime(result.resendAt),
        expiresAt: toTime(result.expiresAt),
      };
    case "cooldown": {
      // Another tab (or a moment ago) already sent one: a live code for this
      // address is as good as "code sent".
      const expiresAt = toTime(result.expiresAt) ?? base.expiresAt;
      const keep = previous !== null && NEEDS_NEW_CODE.has(previous.status);
      return {
        ...base,
        status: keep || !expiresAt ? base.status : "code_sent",
        attemptsLeft: base.attemptsLeft ?? UBC_CODE_MAX_ATTEMPTS,
        resendAt: toTime(result.resendAt),
        expiresAt,
      };
    }
    case "daily_cap":
      return { ...base, status: "daily_cap", resendAt: null };
    case "taken":
      return { ...base, status: "taken", resendAt: null };
    case "already_verified":
      return { ...base, status: "verified" };
    case "send_failed":
      return { ...base, status: "send_failed", resendAt: null };
    case "address_changed":
      // The step closes (`onAddressChanged`); nothing here changes.
      return base;
  }
}

export function initialCodeState(start: UbcCodeStart): UbcCodeState {
  if (start.kind === "send") return stateAfterSend(start.result, null);
  const { pending } = start;
  return {
    status: pending.attemptsLeft > 0 ? "code_sent" : "locked",
    attemptsLeft: pending.attemptsLeft,
    resendAt: toTime(pending.resendAt),
    expiresAt: toTime(pending.expiresAt),
  };
}

export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function triesLeft(count: number) {
  return `${count} ${count === 1 ? "try" : "tries"} left`;
}

/** The line under the field, and whether it describes an error. */
export function codeMessage(status: UbcCodeStatus, attemptsLeft: number | null) {
  switch (status) {
    case "wrong":
      return {
        text: `That code isn’t right. ${triesLeft(attemptsLeft ?? 0)}.`,
        error: true,
      };
    case "malformed":
      return { text: "Enter the 6-digit code from the email.", error: true };
    case "expired":
      return { text: "This code has expired.", error: true };
    case "locked":
      return { text: "Too many tries. Send a new code.", error: true };
    case "stale":
      return { text: "We sent a newer code. Enter the code from the latest email.", error: true };
    case "no_code":
      return { text: "Send a code to verify this address.", error: false };
    case "daily_cap":
      return {
        text: "You’ve requested too many codes today. Try again tomorrow, or contact a UX Hub exec.",
        error: true,
      };
    case "taken":
      return {
        text: "This UBC email is already verified on another UX Hub account. Contact a UX Hub exec.",
        error: true,
      };
    case "send_failed":
      return { text: "We couldn’t send the code. Try again.", error: true };
    case "error":
      return { text: "Something went wrong. Try again.", error: true };
    case "verified":
      return { text: "Verified", error: false };
    default:
      return null;
  }
}

export function UbcCodeStep({
  client,
  email,
  onBusyChange,
  onAddressChanged,
  onChangeEmail,
  onVerified,
  start,
  initialState,
}: {
  client: UbcCodeClient;
  email: string;
  onBusyChange?: (busy: boolean) => void;
  /**
   * The saved address changed under this step (another tab), so its code is
   * for the wrong address: back to the form, which says so.
   */
  onAddressChanged: () => void;
  onChangeEmail: () => void;
  onVerified: () => void;
  start: UbcCodeStart;
  /** Opens on this state instead of the one `start` implies: for previews. */
  initialState?: UbcCodeState;
}) {
  const ids = useId();
  const inputId = `${ids}-code`;
  const messageId = `${ids}-message`;
  const helpId = `${ids}-help`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UbcCodeState>(() => initialState ?? initialCodeState(start));
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"send" | "verify" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState(() =>
    state.status === "code_sent" && start.kind === "send" ? "Code sent" : "",
  );

  // The clock behind the Resend countdown and the code's expiry. Only Resend
  // becoming available is announced, not every second.
  const { resendAt, expiresAt } = state;
  useEffect(() => {
    const deadlines = [resendAt, expiresAt].filter(
      (value): value is number => value !== null && value > Date.now(),
    );
    if (deadlines.length === 0) return;
    let last = Date.now();
    const passed = (deadline: number | null, current: number) =>
      deadline !== null && last < deadline && current >= deadline;
    const timer = setInterval(() => {
      const current = Date.now();
      if (passed(expiresAt, current)) setAnnouncement("Code expired");
      else if (passed(resendAt, current)) setAnnouncement("You can resend the code now.");
      last = current;
      setNow(current);
      if (deadlines.every((deadline) => current >= deadline)) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt, expiresAt]);

  // Focus moves to the code field when the step opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const verified = state.status === "verified";
  // Once: a parent that re-renders mid-navigation hands in a new callback.
  const notified = useRef(false);
  useEffect(() => {
    if (!verified || notified.current) return;
    notified.current = true;
    onVerified();
  }, [verified, onVerified]);

  // A code that ran out while the step was open counts as expired.
  const codeExpired = state.expiresAt !== null && now >= state.expiresAt;
  const status: UbcCodeStatus =
    codeExpired && ["code_sent", "wrong", "malformed", "stale"].includes(state.status)
      ? "expired"
      : state.status;
  const cooldown = state.resendAt === null ? 0 : getRemainingCooldownSeconds(state.resendAt, now);
  const liveCode = state.expiresAt !== null && !codeExpired;

  const needsNewCode =
    status === "expired" || status === "locked" || status === "no_code" || (status === "send_failed" && !liveCode);
  const blocked = status === "taken" || (status === "daily_cap" && !liveCode);
  const fieldDisabled = verified || blocked || needsNewCode || pending !== null;
  // Asked again within the cooldown, for an address no code went to yet.
  const message =
    status === "no_code" && cooldown > 0
      ? {
          text: "You asked for a code a moment ago. Send one to this address when the timer runs out.",
          error: false,
        }
      : codeMessage(status, state.attemptsLeft);
  const busy = pending !== null;

  const run = async <T,>(kind: "send" | "verify", action: () => Promise<T>) => {
    setPending(kind);
    onBusyChange?.(true);
    try {
      return await action();
    } finally {
      setPending(null);
      onBusyChange?.(false);
    }
  };

  const send = async () => {
    if (busy || cooldown > 0) return;
    let result: UbcSendResult;
    try {
      result = await run("send", client.sendCode);
    } catch {
      result = { status: "send_failed" };
    }
    if (result.status === "address_changed") {
      onAddressChanged();
      return;
    }
    const next = stateAfterSend(result, state);
    setState(next);
    setNow(Date.now());
    if (result.status === "sent") {
      setCode("");
      setAnnouncement("Code sent");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (result.status === "already_verified") {
      setAnnouncement("Verified");
    } else {
      setAnnouncement(codeMessage(next.status, null)?.text ?? "");
    }
  };

  const verify = async (value: string) => {
    if (busy || fieldDisabled) return;
    if (value.length !== UBC_CODE_LENGTH) {
      setState((previous) => ({ ...previous, status: "malformed" }));
      setAnnouncement("Enter the 6-digit code from the email.");
      inputRef.current?.focus();
      return;
    }
    let result: UbcVerifyResult;
    try {
      result = await run("verify", () => client.verifyCode(value));
    } catch {
      result = { status: "error" };
    }
    setNow(Date.now());
    switch (result.status) {
      case "address_changed":
        onAddressChanged();
        return;
      case "verified":
        setState((previous) => ({ ...previous, status: "verified" }));
        setAnnouncement("Verified");
        return;
      case "wrong":
        setState((previous) => ({ ...previous, status: "wrong", attemptsLeft: result.attemptsLeft }));
        setAnnouncement(`That code isn’t right. ${triesLeft(result.attemptsLeft)}.`);
        // Keep focus in the field with its contents selected, so typing replaces them.
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
        return;
      case "none":
        setState((previous) => ({ ...previous, status: "no_code", expiresAt: null }));
        break;
      case "expired":
      case "locked":
      case "stale":
      case "taken":
      case "malformed":
      case "error":
        setState((previous) => ({
          ...previous,
          status: result.status,
          attemptsLeft: result.status === "locked" ? 0 : previous.attemptsLeft,
        }));
        break;
    }
    if (result.status === "stale") setCode("");
    const next = codeMessage(result.status === "none" ? "no_code" : result.status, null);
    setAnnouncement(result.status === "expired" ? "Code expired" : next?.text ?? "");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onCodeChange = (raw: string) => {
    const digits = extractUbcCodeDigits(raw);
    setCode(digits);
    // Paste, autofill or the sixth keystroke submits.
    if (digits.length === UBC_CODE_LENGTH && digits !== code) void verify(digits);
  };

  const resendLabel =
    pending === "send"
      ? "Sending…"
      : cooldown > 0
        ? `Resend code in ${formatCountdown(cooldown)}`
        : "Resend code";

  return (
    <div className="flex min-h-full flex-col">
      <div>
        <h1 className="text-h2">Verify your UBC email</h1>
        <p className="mt-2 text-small text-muted-foreground">
          {state.expiresAt !== null && status !== "send_failed" ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>. Check Junk too.
            </>
          ) : (
            <>
              We’ll email a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          )}
        </p>
      </div>

      <form
        className="mt-8 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (needsNewCode) void send();
          else void verify(code);
        }}
      >
        <Label htmlFor={inputId}>Verification code</Label>
        <div className="flex items-center gap-3">
          <Input
            ref={inputRef}
            id={inputId}
            name="one-time-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            placeholder="000000"
            className="max-w-48 font-mono text-lg tracking-[0.3em]"
            value={code}
            disabled={fieldDisabled}
            aria-invalid={message?.error ? true : undefined}
            aria-describedby={[message && !verified ? messageId : null, helpId].filter(Boolean).join(" ")}
            onChange={(event) => onCodeChange(event.target.value)}
          />
          {verified ? (
            <Badge variant="success">
              <CircleCheck aria-hidden />
              Verified
            </Badge>
          ) : null}
        </div>
        {message && !verified ? (
          <p
            id={messageId}
            className={message.error ? "text-small text-destructive" : "text-small text-muted-foreground"}
          >
            {message.text}
          </p>
        ) : null}
        <p id={helpId} className="text-small text-muted-foreground">
          Can’t get the code? Contact a UX Hub exec and they can verify you.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="link" size="sm" onClick={onChangeEmail} disabled={busy || verified}>
              Change email
            </Button>
            {!needsNewCode && !blocked && !verified && status !== "daily_cap" ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void send()}
                disabled={busy || cooldown > 0}
              >
                {resendLabel}
              </Button>
            ) : null}
          </div>
          {blocked || verified ? null : needsNewCode ? (
            <Button type="submit" className="ml-auto" disabled={busy || cooldown > 0}>
              {pending === "send"
                ? "Sending…"
                : cooldown > 0
                  ? `Send a new code in ${formatCountdown(cooldown)}`
                  : status === "no_code"
                    ? "Send code"
                    : "Send a new code"}
            </Button>
          ) : (
            <Button type="submit" className="ml-auto" disabled={busy}>
              {pending === "verify" ? "Verifying…" : "Verify"}
            </Button>
          )}
        </div>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
