import * as Sentry from "@sentry/nextjs";

import { scrubServerEvent, sentryOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryOptions,
  beforeSend: scrubServerEvent,
});
