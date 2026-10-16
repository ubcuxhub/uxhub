import { describe, expect, it } from "vitest";

import { resolveTarget } from "./integration";

const LOCAL = {
  INTEGRATION_SUPABASE_URL: "http://127.0.0.1:15431",
  INTEGRATION_SUPABASE_SECRET_KEY: "local-secret",
};

describe("resolveTarget", () => {
  it("accepts a local target", () => {
    expect(resolveTarget(LOCAL)).toEqual({
      url: "http://127.0.0.1:15431",
      secretKey: "local-secret",
    });
  });

  it.each(["http://localhost:15431", "http://[::1]:15431"])(
    "accepts %s",
    (url) => {
      expect(
        resolveTarget({ ...LOCAL, INTEGRATION_SUPABASE_URL: url }).url,
      ).toBe(url);
    },
  );

  it.each([
    "https://otsvpvnoqwlenghobdal.supabase.co",
    "https://127.0.0.1.example.com",
    "http://192.168.1.10:15431",
  ])("refuses the remote target %s", (url) => {
    // These helpers delete rows with the service-role key, and a developer's
    // .env.local points at the hosted project.
    expect(() =>
      resolveTarget({ ...LOCAL, INTEGRATION_SUPABASE_URL: url }),
    ).toThrow(/refuse to run against/);
  });

  it("falls back to the app's own variables", () => {
    expect(
      resolveTarget({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:15431",
        SUPABASE_SECRET_KEY: "from-ci",
      }),
    ).toEqual({ url: "http://127.0.0.1:15431", secretKey: "from-ci" });
  });

  it("prefers the integration-specific variables over the app's", () => {
    expect(
      resolveTarget({
        ...LOCAL,
        NEXT_PUBLIC_SUPABASE_URL: "https://hosted.supabase.co",
        SUPABASE_SECRET_KEY: "hosted-secret",
      }),
    ).toEqual({ url: "http://127.0.0.1:15431", secretKey: "local-secret" });
  });

  it.each([
    ["no url", { INTEGRATION_SUPABASE_SECRET_KEY: "k" }],
    ["no key", { INTEGRATION_SUPABASE_URL: "http://127.0.0.1:15431" }],
    ["neither", {}],
  ])("explains how to start the database when there is %s", (_label, env) => {
    expect(() => resolveTarget(env)).toThrow(/pnpm supabase:local/);
  });

  it("ignores surrounding whitespace", () => {
    expect(
      resolveTarget({
        INTEGRATION_SUPABASE_URL: "  http://127.0.0.1:15431  ",
        INTEGRATION_SUPABASE_SECRET_KEY: "  local-secret  ",
      }),
    ).toEqual({ url: "http://127.0.0.1:15431", secretKey: "local-secret" });
  });
});
