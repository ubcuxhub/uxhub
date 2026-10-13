import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Shared Sentry setup for the server and the browser.
 *
 * Sentry is enabled only where `NEXT_PUBLIC_SENTRY_DSN` is set: production and
 * preview deploys. Locally and in CI the DSN is empty and every call is a no-op.
 *
 * Events leave for a third party and are kept longer than our logs, so both
 * runtimes scrub them first. The server goes further than the browser: it drops
 * exception messages, because a rethrown Supabase error can quote row data. See
 * `errorFields` in `@/lib/log` for the same rule applied to logs.
 */
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Vercel sets this to "production" or "preview"; unset locally.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  sendDefaultPii: false,
  tracesSampleRate: 0,
};

/**
 * Drops the query string and hash. The auth callback receives a one-time
 * `?code=`, and nothing in a query string is needed to debug an error.
 */
export function stripUrl(url: string) {
  return url.split(/[?#]/, 1)[0];
}

const URL_BREADCRUMB_KEYS = ["url", "from", "to"] as const;

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;

  const data = { ...breadcrumb.data };

  for (const key of URL_BREADCRUMB_KEYS) {
    if (typeof data[key] === "string") data[key] = stripUrl(data[key]);
  }

  return { ...breadcrumb, data };
}

function scrubRequestAndUrls(event: ErrorEvent) {
  if (event.request) {
    const userAgent = event.request.headers?.["user-agent"];

    event.request = {
      method: event.request.method,
      url: event.request.url && stripUrl(event.request.url),
      headers: userAgent ? { "user-agent": userAgent } : undefined,
    };
  }

  const requestPath = event.contexts?.nextjs?.request_path;

  if (typeof requestPath === "string") {
    event.contexts!.nextjs!.request_path = stripUrl(requestPath);
  }

  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
}

function readCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;

  const code = (error as Record<string, unknown>).code;

  return typeof code === "string" ? code : undefined;
}

export function scrubServerEvent(event: ErrorEvent, hint: EventHint) {
  scrubRequestAndUrls(event);

  // Keep the error type, plus the database code on the outermost error
  // (`PostgrestError 23505`), and drop the message.
  const values = event.exception?.values ?? [];
  const code = readCode(hint.originalException);

  values.forEach((value, index) => {
    const type = value.type ?? "Error";
    const isOutermost = index === values.length - 1;

    value.value = isOutermost && code ? `${type} ${code}` : type;
  });

  // `log` already sends what matters; other console output is unreviewed.
  event.breadcrumbs = event.breadcrumbs?.filter(
    (breadcrumb) => breadcrumb.category !== "console",
  );

  return event;
}

export function scrubClientEvent(event: ErrorEvent) {
  scrubRequestAndUrls(event);

  return event;
}
