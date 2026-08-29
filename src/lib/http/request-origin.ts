/**
 * Resolve the origin the browser actually used for a request.
 *
 * `request.url` is not reliable for this: the Next.js server rebuilds it from
 * its own bind address, so a request made to `http://127.0.0.1:3000` reports
 * `http://localhost:3000` (and a deployment behind a proxy reports the
 * internal host). Redirecting to that origin lands the browser on a different
 * origin than the one it authenticated on, so freshly set cookies are not sent
 * and the user appears signed out.
 *
 * Forwarded headers win when present, then the `Host` header, then whatever
 * `request.url` claims.
 */
export function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host"));

  if (!host) return requestUrl.origin;

  const protocol =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

/** Forwarded headers may carry a comma-separated proxy chain. */
function firstHeaderValue(value: string | null) {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}
