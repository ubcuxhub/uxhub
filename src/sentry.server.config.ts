import * as Sentry from "@sentry/nextjs";

import { scrubServerEvent, sentryOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryOptions,
  // `log.error` events are titled by their event name. A stack trace would
  // wrap each one in a synthetic exception, which Sentry titles after the
  // calling function (`emit`) and which the scrubber then empties.
  attachStacktrace: false,
  beforeSend: scrubServerEvent,
});
