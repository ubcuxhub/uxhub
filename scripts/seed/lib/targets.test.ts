import { describe, expect, it } from "vitest";

import {
  isLocalHost,
  parseTarget,
  resolveTarget,
  TARGET_POLICIES,
} from "./targets.ts";

const localEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:15431",
  SUPABASE_SECRET_KEY: "sb_secret_local",
};

const prodEnv = {
  SEED_PROD_SUPABASE_URL: "https://otsvpvnoqwlenghobdal.supabase.co",
  SEED_PROD_SUPABASE_SECRET_KEY: "sb_secret_prod",
};

describe("parseTarget", () => {
  it("accepts the known targets", () => {
    expect(parseTarget("local")).toBe("local");
    expect(parseTarget("prod")).toBe("prod");
  });

  it("rejects anything else", () => {
    expect(() => parseTarget("staging")).toThrow(/Unknown --target "staging"/);
    expect(() => parseTarget("")).toThrow(/Unknown --target/);
  });
});

describe("isLocalHost", () => {
  it("recognizes the local hosts Supabase serves on", () => {
    expect(isLocalHost("http://127.0.0.1:15431")).toBe(true);
    expect(isLocalHost("http://localhost:15431")).toBe(true);
    expect(isLocalHost("http://[::1]:15431")).toBe(true);
  });

  it("treats a deployed project as remote", () => {
    expect(isLocalHost("https://otsvpvnoqwlenghobdal.supabase.co")).toBe(false);
  });
});

describe("resolveTarget", () => {
  it("reads each target from its own env keys", () => {
    const env = { ...localEnv, ...prodEnv };

    expect(resolveTarget("local", env)).toMatchObject({
      target: "local",
      url: localEnv.NEXT_PUBLIC_SUPABASE_URL,
      secretKey: "sb_secret_local",
    });
    expect(resolveTarget("prod", env)).toMatchObject({
      target: "prod",
      url: prodEnv.SEED_PROD_SUPABASE_URL,
      secretKey: "sb_secret_prod",
    });
  });

  it("refuses --target=local when the URL is not local", () => {
    // The failure this exists for: a stale .env.local pointing at the deployed
    // project, with a service-role key that bypasses RLS.
    expect(() =>
      resolveTarget("local", {
        NEXT_PUBLIC_SUPABASE_URL: prodEnv.SEED_PROD_SUPABASE_URL,
        SUPABASE_SECRET_KEY: "sb_secret_local",
      })
    ).toThrow(/--target=local expects a local Supabase/);
  });

  it("refuses --target=prod when the URL is local", () => {
    expect(() =>
      resolveTarget("prod", {
        SEED_PROD_SUPABASE_URL: "http://127.0.0.1:15431",
        SEED_PROD_SUPABASE_SECRET_KEY: "sb_secret_prod",
      })
    ).toThrow(/--target=prod expects the deployed Supabase/);
  });

  it("names the missing key for each target", () => {
    expect(() => resolveTarget("local", {})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/
    );
    expect(() => resolveTarget("prod", {})).toThrow(
      /SEED_PROD_SUPABASE_URL or SEED_PROD_SUPABASE_SECRET_KEY/
    );
  });

  it("rejects a malformed URL", () => {
    expect(() =>
      resolveTarget("prod", {
        SEED_PROD_SUPABASE_URL: "otsvpvnoqwlenghobdal.supabase.co",
        SEED_PROD_SUPABASE_SECRET_KEY: "sb_secret_prod",
      })
    ).toThrow(/is not a valid URL/);
  });

  it("treats blank values as missing", () => {
    expect(() =>
      resolveTarget("prod", {
        SEED_PROD_SUPABASE_URL: "   ",
        SEED_PROD_SUPABASE_SECRET_KEY: "sb_secret_prod",
      })
    ).toThrow(/Missing SEED_PROD_SUPABASE_URL/);
  });
});

describe("target policies", () => {
  it("lets local delete and write login fixtures", () => {
    expect(TARGET_POLICIES.local).toEqual({
      prune: true,
      users: true,
      forceDraft: false,
    });
  });

  it("keeps prod additive, fixture-free, and out of the public API", () => {
    // Each of these is load-bearing. Flipping one silently changes what a
    // `--target=prod` run can do to the deployed database.
    expect(TARGET_POLICIES.prod).toEqual({
      prune: false,
      users: false,
      forceDraft: true,
    });
  });
});
