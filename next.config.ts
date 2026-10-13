import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

// Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel builds). CI and
// local builds skip the upload.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sends browser events through our own origin so ad blockers don't drop them.
  // Not in the `proxy.ts` matcher, so it skips the session refresh.
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
