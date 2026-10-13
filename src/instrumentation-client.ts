import * as Sentry from "@sentry/nextjs";

import { scrubClientEvent, sentryOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryOptions,
  beforeSend: scrubClientEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
