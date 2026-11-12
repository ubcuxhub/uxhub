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

  return (
    getHeadersOrigin(request.headers, requestUrl.protocol.replace(":", "")) ??
    requestUrl.origin
  );
}

/**
 * The same origin from the headers alone, for a server component (pass it
 * `await headers()`). Null without a host header.
 */
export function getHeadersOrigin(
  headers: Pick<Headers, "get">,
  fallbackProtocol = "https"
) {
  const host =
    firstHeaderValue(headers.get("x-forwarded-host")) ??
    firstHeaderValue(headers.get("host"));

  if (!host) return null;

  const protocol =
    firstHeaderValue(headers.get("x-forwarded-proto")) ?? fallbackProtocol;

  return `${protocol}://${host}`;
}

/** Forwarded headers may carry a comma-separated proxy chain. */
function firstHeaderValue(value: string | null) {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}
