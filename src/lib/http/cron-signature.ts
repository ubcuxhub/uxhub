import { createHmac, timingSafeEqual } from "node:crypto";

/** How far a signed timestamp may drift from now, either way. */
const MAX_SKEW_SECONDS = 300;

/**
 * Checks a pg_cron call to an `/api/internal/*` route. The job sends
 * `<headerPrefix>-timestamp` (Unix seconds) and `<headerPrefix>-signature`,
 * the hex HMAC-SHA256 of `<purpose>:<timestamp>` under `secret`. Binding the
 * purpose into the message means one route's signature never opens another
 * that shares the secret, and the timestamp window stops a replay after five
 * minutes. False when the secret is unset, so an unconfigured route stays shut.
 */
export function verifyCronSignature(
  request: Request,
  {
    secret,
    purpose,
    headerPrefix,
  }: { secret: string | undefined; purpose: string; headerPrefix: string },
): boolean {
  const timestamp = request.headers.get(`${headerPrefix}-timestamp`) ?? "";
  const signature = request.headers.get(`${headerPrefix}-signature`) ?? "";
  if (
    !secret ||
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS
  ) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${purpose}:${timestamp}`)
    .digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
