import { afterEach, describe, expect, it, vi } from "vitest";

interface FlagEnv {
  vercelEnv?: string;
  studentEvents?: string;
  darkMode?: string;
}

// FLAGS is resolved once at module load, so each case needs a fresh import.
async function loadFlags(env: FlagEnv) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env.vercelEnv);
  vi.stubEnv("NEXT_PUBLIC_FEATURE_STUDENT_EVENTS", env.studentEvents);
  vi.stubEnv("NEXT_PUBLIC_FEATURE_DARK_MODE", env.darkMode);

  return (await import("./flags")).FLAGS;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("FLAGS defaults", () => {
  // This is the one that matters: an unlaunched feature must be off in
  // production without anyone having to remember to set a variable.
  it("hides unlaunched features on the production deployment", async () => {
    const flags = await loadFlags({ vercelEnv: "production" });

    expect(flags.studentEvents).toBe(false);
    expect(flags.darkMode).toBe(false);
  });

  it.each([
    ["a preview deployment", "preview"],
    ["a local run", undefined],
    ["an unrecognized environment", "development"],
  ])("shows them on %s", async (_label, vercelEnv) => {
    const flags = await loadFlags({ vercelEnv });

    expect(flags.studentEvents).toBe(true);
    expect(flags.darkMode).toBe(true);
  });
});

describe("FLAGS overrides", () => {
  it("turns a feature on in production when explicitly set", async () => {
    const flags = await loadFlags({
      vercelEnv: "production",
      studentEvents: "true",
    });

    expect(flags.studentEvents).toBe(true);
    expect(flags.darkMode).toBe(false);
  });

  it("turns a feature off outside production when explicitly set", async () => {
    const flags = await loadFlags({
      vercelEnv: "preview",
      darkMode: "false",
    });

    expect(flags.darkMode).toBe(false);
    expect(flags.studentEvents).toBe(true);
  });

  // Only the exact strings count. Anything else is a typo, and a typo must not
  // read as "on" in production.
  it.each(["1", "TRUE", "yes", "True", " true", ""])(
    "ignores %o as an override and keeps the environment default",
    async (studentEvents) => {
      const flags = await loadFlags({
        vercelEnv: "production",
        studentEvents,
      });

      expect(flags.studentEvents).toBe(false);
    }
  );

  it.each(["0", "FALSE", "no", "False"])(
    "ignores %o as an override outside production",
    async (studentEvents) => {
      const flags = await loadFlags({ studentEvents });

      expect(flags.studentEvents).toBe(true);
    }
  );

  it("treats only an exact match of the production environment as production", async () => {
    const flags = await loadFlags({ vercelEnv: "Production" });

    expect(flags.studentEvents).toBe(true);
  });
});
