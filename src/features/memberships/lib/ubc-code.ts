import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { UBC_CODE_LENGTH } from "./ubc-verification";

/**
 * The 6-digit UBC verification code: made, hashed and compared here, never in
 * SQL. The database stores only the salted hash, which keeps the code out of
 * backups and logs in plaintext; the comparison is constant-time.
 *
 * There is no pepper. The only reader of the hash is the service role, which
 * can already stamp a verification directly, so a secret would protect
 * nothing.
 */

export function generateUbcCode() {
  return randomInt(0, 10 ** UBC_CODE_LENGTH).toString().padStart(UBC_CODE_LENGTH, "0");
}

/** 16 random bytes, new for every send. */
export function newUbcCodeSalt() {
  return randomBytes(16);
}

/**
 * sha256(salt ‖ user id ‖ ":" ‖ email ‖ ":" ‖ code). Binding the member and the
 * address means a code is only good for the send it was made for.
 */
export function hashUbcCode({
  code,
  email,
  salt,
  userId,
}: {
  code: string;
  email: string;
  salt: Buffer;
  userId: string;
}) {
  return createHash("sha256")
    .update(salt)
    .update(`${userId}:${email}:${code}`, "utf8")
    .digest();
}

export function ubcCodeHashesMatch(expected: Buffer, actual: Buffer) {
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
