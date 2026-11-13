import { getSafeInternalPath } from "@/lib/auth/paths";

export type ExpiredLinkType = "verify" | "reset";

/** Supabase `error_code` values that mean "this link is no longer usable". */
const EXPIRED_LINK_CODES = new Set([
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
]);

export function isExpiredLinkCode(code: string | null | undefined): boolean {
  return Boolean(code) && EXPIRED_LINK_CODES.has(code as string);
}

export function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function parseExpiredLinkType(
  value: string | null | undefined,
): ExpiredLinkType {
  return value === "reset" ? "reset" : "verify";
}

/**
 * The link a recovery email carries lands on the update form; every other
 * auth link is a confirmation. That is how the callback picks the screen.
 */
export function getExpiredLinkTypeForNext(nextPath: string): ExpiredLinkType {
  return nextPath === "/auth/update-password" ? "reset" : "verify";
}

/** The expired-link screen, with fixed copy chosen by `type`, never by URL text. */
export function getExpiredLinkPath(
  type: ExpiredLinkType,
  nextPath?: string | null,
): string {
  const params = new URLSearchParams({ type });
  const safeNext = getSafeInternalPath(nextPath);
  if (type === "verify" && safeNext !== "/portal") {
    params.set("next", safeNext);
  }
  return `/auth/link-expired?${params.toString()}`;
}
