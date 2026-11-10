import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  UBC_ADDRESS_PROOFS,
  UBC_CODE_MAX_ATTEMPTS,
  UBC_CODE_RESEND_SECONDS,
  UBC_VERIFICATION_TTL_DAYS,
  type PendingUbcCode,
} from "@/features/memberships/lib/ubc-verification";
import { TABLES } from "./tables";

/**
 * Service-role access to UBC verification: the three code-flow functions and
 * the code row. `ubc_verification_codes` has RLS on with no policies, so these
 * take the service-role client (`supabaseAdmin`, or the integration client in
 * tests) and must only run on the server.
 *
 * The code itself never arrives here, only its hash; bytea crosses PostgREST
 * as `\x`-prefixed hex.
 */

type ServiceClient = SupabaseClient;

function toBytea(value: Buffer) {
  return `\\x${value.toString("hex")}`;
}

function fromBytea(value: string | null) {
  if (!value) return null;
  return Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex");
}

function single<T>(data: unknown): T {
  return (Array.isArray(data) ? data[0] : data) as T;
}

export type ClaimUbcCodeResult =
  | "ok"
  | "cooldown"
  | "daily_cap"
  | "taken"
  | "already_verified"
  | "mismatch";

export async function claimUbcCodeSend(
  db: ServiceClient,
  input: { userId: string; email: string; codeHash: Buffer; salt: Buffer },
) {
  const { data, error } = await db.rpc("claim_ubc_code_send", {
    p_user: input.userId,
    p_email: input.email,
    p_code_hash: toBytea(input.codeHash),
    p_salt: toBytea(input.salt),
  });
  if (error) throw error;
  const row = single<{
    result: ClaimUbcCodeResult;
    resend_at: string | null;
    expires_at: string | null;
  }>(data);
  return { result: row.result, resendAt: row.resend_at, expiresAt: row.expires_at };
}

export type BeginUbcAttemptResult = "ok" | "none" | "stale" | "expired" | "locked";

export async function beginUbcCodeAttempt(
  db: ServiceClient,
  input: { userId: string; email: string },
) {
  const { data, error } = await db.rpc("begin_ubc_code_attempt", {
    p_user: input.userId,
    p_email: input.email,
  });
  if (error) throw error;
  const row = single<{
    result: BeginUbcAttemptResult;
    challenge_sent_at: string | null;
    code_hash: string | null;
    code_salt: string | null;
    attempts_left: number | null;
  }>(data);
  return {
    result: row.result,
    challengeSentAt: row.challenge_sent_at,
    codeHash: fromBytea(row.code_hash),
    codeSalt: fromBytea(row.code_salt),
    attemptsLeft: row.attempts_left,
  };
}

export type CompleteUbcVerificationResult =
  | "verified"
  | "already_verified"
  | "stale"
  | "taken";

export async function completeUbcCodeVerification(
  db: ServiceClient,
  input: { userId: string; email: string; challengeSentAt: string },
): Promise<CompleteUbcVerificationResult> {
  const { data, error } = await db.rpc("complete_ubc_code_verification", {
    p_user: input.userId,
    p_email: input.email,
    p_challenge_sent_at: input.challengeSentAt,
  });
  if (error) throw error;
  return data as CompleteUbcVerificationResult;
}

/**
 * The member's live code, for reopening the details step in the code state:
 * when it was sent, when it expires, when Resend unlocks and how many tries
 * are left. Null once it is used or expired. Never reads the hash.
 */
export async function fetchPendingUbcCode(
  db: ServiceClient,
  userId: string,
  now = new Date(),
): Promise<PendingUbcCode | null> {
  const { data, error } = await db
    .from(TABLES.ubcVerificationCodes)
    .select("email, expires_at, last_sent_at, attempts")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const row = data as {
    email: string;
    expires_at: string | null;
    last_sent_at: string;
    attempts: number;
  } | null;
  if (!row?.expires_at || new Date(row.expires_at) <= now) return null;

  return {
    email: row.email,
    sentAt: row.last_sent_at,
    expiresAt: row.expires_at,
    resendAt: new Date(
      new Date(row.last_sent_at).getTime() + UBC_CODE_RESEND_SECONDS * 1000,
    ).toISOString(),
    attemptsLeft: Math.max(0, UBC_CODE_MAX_ATTEMPTS - row.attempts),
  };
}

/**
 * Clears another account's proof of `email` (a `code` or `sign_in_email`
 * stamp, the only kinds that hold an address) when it is over a year old, so
 * it stops holding the address (the one-account-per-address index). The
 * code flow does the same inside `complete_ubc_code_verification`; this is
 * for the sign-in email stamp, which is a plain update.
 */
export async function releaseStaleUbcEmailHolds(
  db: ServiceClient,
  { email, userId }: { email: string; userId: string },
  now = new Date(),
) {
  const cutoff = new Date(
    now.getTime() - UBC_VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await db
    .from(TABLES.userInfo)
    .update({ ubc_verified_at: null, ubc_verified_via: null, ubc_verified_by: null })
    .eq("ubc_email", email)
    .neq("id", userId)
    .is("deleted_at", null)
    .in("ubc_verified_via", [...UBC_ADDRESS_PROOFS])
    .lte("ubc_verified_at", cutoff);
  if (error) throw error;
}
