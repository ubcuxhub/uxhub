import type {
  MembershipTypeRow,
  UbcVerificationMethod,
  UserInfoRow,
  UserType,
} from "@/lib/supabase/models";
import { hasActiveOrPendingMembership } from "@/features/memberships/lib/expiry";

/**
 * UBC email verification rules, shared by the join flow, the payment guard
 * and admin. See docs/design/ubc-email-verification.md.
 *
 * Pure and client-safe: the code itself is generated, hashed and compared in
 * `ubc-code.ts`, which is server-only.
 */

/** How long a `code`, `sign_in_email` or `manual` verification counts. */
export const UBC_VERIFICATION_TTL_DAYS = 365;
export const UBC_CODE_LENGTH = 6;
export const UBC_CODE_TTL_MINUTES = 10;
export const UBC_CODE_MAX_ATTEMPTS = 5;
export const UBC_CODE_RESEND_SECONDS = 60;
export const UBC_CODE_SENDS_PER_DAY = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The methods that prove an address, and so hold it: only one live account
 * may hold a given address this way (`user_info_ubc_email_verified_key`). A
 * manual or grandfathered stamp vouches for the member, not an address.
 */
export const UBC_ADDRESS_PROOFS = ["code", "sign_in_email"] as const;

/**
 * Whether buying `membership` needs a UBC verification: only tiers for UBC
 * audiences alone. A tier Non-UBC members can buy too (the production payment
 * smoke-test tier, say) proves nothing about UBC, so it isn't gated.
 */
export function tierRequiresUbcVerification(
  membership: Pick<MembershipTypeRow, "eligible_user_types">,
) {
  return !membership.eligible_user_types.includes("nonUbc");
}

export type UbcAudience = "student" | "faculty";

export function ubcAudienceForUserType(userType: UserType): UbcAudience | null {
  if (userType === "ubcStudent") return "student";
  if (userType === "faculty") return "faculty";
  return null;
}

export function normalizeUbcEmail(raw: string) {
  return raw.trim().toLowerCase();
}

// One or more DNS labels, then ubc.ca: "ubc.ca", "cs.ubc.ca". The anchors and
// the label boundary reject "ubc.ca.evil.com" and "evilubc.ca".
const UBC_ADDRESS = /^[^\s@]+@((?:[a-z0-9-]+\.)*ubc\.ca)$/;

function ubcDomain(email: string) {
  return UBC_ADDRESS.exec(email)?.[1] ?? null;
}

function isStudentOrAlumniDomain(domain: string) {
  return ["student.ubc.ca", "alumni.ubc.ca"].some(
    (excluded) => domain === excluded || domain.endsWith(`.${excluded}`),
  );
}

/**
 * Whether an address can prove the audience: students use `@student.ubc.ca`
 * exactly; faculty use `ubc.ca` or any subdomain except student and alumni
 * ones. Returns an error message, or null when it qualifies. Mirrors
 * `public.ubc_email_qualifies` in the database.
 */
export function validateUbcEmail(raw: string, audience: UbcAudience): string | null {
  const email = normalizeUbcEmail(raw);
  if (!email) {
    return audience === "student"
      ? "Enter your UBC student email."
      : "Enter your UBC faculty or staff email.";
  }
  const domain = ubcDomain(email);
  if (audience === "student") {
    return domain === "student.ubc.ca"
      ? null
      : "Use your UBC student email, ending in @student.ubc.ca.";
  }
  if (!domain) return "Use your UBC email address, ending in ubc.ca.";
  if (isStudentOrAlumniDomain(domain)) {
    return "Use your UBC faculty or staff email, not a student or alumni one.";
  }
  return null;
}

export function ubcEmailQualifies(raw: string | null | undefined, audience: UbcAudience) {
  return raw ? validateUbcEmail(raw, audience) === null : false;
}

/** The user columns UBC verification reads. */
export type UbcVerificationUser = Pick<
  UserInfoRow,
  | "membership_expires_at"
  | "membership_pre_ordered_type_id"
  | "membership_type_id"
  | "ubc_email"
  | "ubc_verified_at"
  | "ubc_verified_via"
  | "user_type"
>;

export type UbcVerificationStatus =
  | { state: "verified"; via: UbcVerificationMethod; at: string }
  | { state: "expired"; via: UbcVerificationMethod; at: string }
  | { state: "unverified" }
  | { state: "n/a" };

function withinTtl(at: string, now: Date) {
  const stamped = new Date(at).getTime();
  if (Number.isNaN(stamped)) return false;
  return stamped > now.getTime() - UBC_VERIFICATION_TTL_DAYS * DAY_MS;
}

/** When a `code`, `sign_in_email` or `manual` stamp stops counting. */
export function ubcVerificationExpiresAt(at: string) {
  return new Date(new Date(at).getTime() + UBC_VERIFICATION_TTL_DAYS * DAY_MS).toISOString();
}

/**
 * Where the member stands, for admin and Settings. A grandfathered stamp is
 * verified only while the membership held when the migration ran lasts (it
 * can't be renewed without a code, so "the current membership" is whatever
 * membership is active or pending now). Every other method counts for 365
 * days.
 */
export function ubcVerificationStatus(
  user: UbcVerificationUser,
  { now = new Date(), termEndsAt }: { now?: Date; termEndsAt: string | null },
): UbcVerificationStatus {
  if (!ubcAudienceForUserType(user.user_type)) return { state: "n/a" };
  if (!user.ubc_verified_at || !user.ubc_verified_via) return { state: "unverified" };

  const stamp = { via: user.ubc_verified_via, at: user.ubc_verified_at };
  const current =
    user.ubc_verified_via === "grandfathered"
      ? hasActiveOrPendingMembership(user, termEndsAt)
      : withinTtl(user.ubc_verified_at, now);
  return { state: current ? "verified" : "expired", ...stamp };
}

/**
 * Whether the member may pay for a membership now. Non-UBC members need
 * nothing. Grandfathering never qualifies: it only covers the membership the
 * member already held, so their next purchase or renewal asks for a code.
 * Shared by `isEligibleForMembership` and the payment guard.
 */
export function hasPurchaseUbcVerification(
  user: Pick<UbcVerificationUser, "ubc_verified_at" | "ubc_verified_via" | "user_type">,
  now = new Date(),
) {
  if (!ubcAudienceForUserType(user.user_type)) return true;
  if (!user.ubc_verified_at) return false;
  return (
    (user.ubc_verified_via === "code" ||
      user.ubc_verified_via === "sign_in_email" ||
      user.ubc_verified_via === "manual") &&
    withinTtl(user.ubc_verified_at, now)
  );
}

/**
 * What the member typed or pasted, reduced to at most six digits, so
 * "123 456" and "Code: 123456" both work.
 */
export function extractUbcCodeDigits(raw: string) {
  return raw.replace(/\D/g, "").slice(0, UBC_CODE_LENGTH);
}

/**
 * The server's stricter reading: six digits after stripping spaces and
 * dashes, or null. Anything else is refused before it costs an attempt.
 */
export function normalizeUbcCodeInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** A pending code as the details step sees it: never the hash. */
export interface PendingUbcCode {
  email: string;
  sentAt: string;
  expiresAt: string;
  resendAt: string;
  attemptsLeft: number;
}

/** The outcome of asking for a code. */
export type UbcSendResult =
  | { status: "sent"; resendAt: string; expiresAt: string }
  | { status: "cooldown"; resendAt: string; expiresAt: string | null }
  | { status: "daily_cap" }
  | { status: "taken" }
  | { status: "already_verified" }
  /** The saved address changed (another tab); the form has to be saved again. */
  | { status: "address_changed" }
  | { status: "send_failed" };

/** The outcome of entering a code. */
export type UbcVerifyResult =
  | { status: "verified" }
  | { status: "wrong"; attemptsLeft: number }
  | { status: "malformed" }
  | { status: "expired" }
  | { status: "locked" }
  /** A newer code was sent to the same address. */
  | { status: "stale" }
  /** The code went to an address that is no longer the saved one. */
  | { status: "address_changed" }
  | { status: "taken" }
  | { status: "none" }
  | { status: "error" };
