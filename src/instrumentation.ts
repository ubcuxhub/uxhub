import * as Sentry from "@sentry/nextjs";

// Nothing in this app runs on the edge runtime (Next 16 runs `proxy.ts` on
// Node), so there is no edge config. Add `sentry.edge.config.ts` if that changes.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Reports errors thrown in server components, route handlers, and server actions.
export const onRequestError = Sentry.captureRequestError;
