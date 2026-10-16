import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A check-in QR code carries `<registration id>.<signature>`.
 *
 * Registration IDs are not secret (they appear in admin URLs), so the HMAC is
 * what proves the server issued the code. A token never expires or changes, so
 * a screenshot of a ticket scans as well as the live page; repeat entry is
 * stopped by the check-in record, not here.
 */

const SECRET_ENV = "CHECK_IN_TOKEN_SECRET";
const MIN_SECRET_LENGTH = 32;
// 128 bits keeps the QR code small enough to scan off a dim phone screen.
const SIGNATURE_BYTES = 16;
// Binds the signature to this purpose, so the same secret can never be
// coaxed into vouching for some other kind of value.
const SIGNING_CONTEXT = "uxhub.check-in.v1:";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getSecret(): string {
  const secret = process.env[SECRET_ENV];

  if (!secret) {
    throw new Error(`Missing required environment variable: ${SECRET_ENV}`);
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${SECRET_ENV} must be at least ${MIN_SECRET_LENGTH} characters.`
    );
  }

  return secret;
}

function sign(registrationId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(SIGNING_CONTEXT + registrationId)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");
}

export function createCheckInToken(registrationId: string): string {
  const id = registrationId.toLowerCase();

  if (!UUID_PATTERN.test(id)) {
    throw new Error("A check-in token can only be issued for a registration ID.");
  }

  return `${id}.${sign(id, getSecret())}`;
}

/**
 * Returns the registration ID a scanned token was issued for, or null when the
 * token is malformed, edited, or was not signed with this server's secret.
 * A missing secret throws rather than rejecting every ticket as invalid.
 */
export function verifyCheckInToken(token: string): string | null {
  const secret = getSecret();
  const parts = token.trim().split(".");

  if (parts.length !== 2) return null;

  const [id, signature] = parts;
  if (!UUID_PATTERN.test(id)) return null;

  // Compare encoded strings, not decoded bytes: base64url decoding ignores
  // stray characters, so two different strings can decode to the same bytes.
  const provided = Buffer.from(signature);
  const expected = Buffer.from(sign(id, secret));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? id : null;
}
