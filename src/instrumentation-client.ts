import * as Sentry from "@sentry/nextjs";

import { scrubClientEvent, sentryOptions } from "@/lib/sentry";

Sentry.init({
  ...sentryOptions,
  beforeSend: scrubClientEvent,
  ignoreErrors: [
    // Microsoft's Outlook Safe Links scanner rejects with this when it opens
    // a link from one of our emails; it is not our code.
    /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
