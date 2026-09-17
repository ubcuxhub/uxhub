import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const squareMocks = vi.hoisted(() => ({
  constructorOptions: [] as Record<string, unknown>[],
  Production: "square-production-environment",
  Sandbox: "square-sandbox-environment",
}));

vi.mock("server-only", () => ({}));

vi.mock("square", () => ({
  SquareClient: class {
    constructor(options: Record<string, unknown>) {
      squareMocks.constructorOptions.push(options);
    }
  },
  SquareEnvironment: {
    Production: squareMocks.Production,
    Sandbox: squareMocks.Sandbox,
  },
}));

interface SquareEnv {
  accessToken?: string;
  squareEnv?: string;
  locationId?: string;
  signatureKey?: string;
  notificationUrl?: string;
  endpoints?: string;
}

// The client is constructed at module scope, so each case needs a fresh import.
async function loadClient(env: SquareEnv = {}) {
  vi.resetModules();
  squareMocks.constructorOptions.length = 0;

  vi.stubEnv("SQUARE_ACCESS_TOKEN", env.accessToken ?? "test-access-token");
  vi.stubEnv("SQUARE_ENV", env.squareEnv);
  vi.stubEnv("NEXT_PUBLIC_SQUARE_LOCATION_ID", env.locationId);
  vi.stubEnv("SQUARE_WEBHOOK_SIGNATURE_KEY", env.signatureKey);
  vi.stubEnv("SQUARE_WEBHOOK_NOTIFICATION_URL", env.notificationUrl);
  vi.stubEnv("SQUARE_WEBHOOK_ENDPOINTS", env.endpoints);

  const client = await import("./client");

  return { client, options: squareMocks.constructorOptions.at(-1) };
}

beforeEach(() => {
  squareMocks.constructorOptions.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Square environment selection", () => {
  // Getting this backwards means either charging real cards from a sandbox
  // deploy or silently taking no money at all in production, so the sandbox
  // default has to hold for every value that is not exactly "production".
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["capitalized", "Production"],
    ["abbreviated", "prod"],
    ["explicitly sandbox", "sandbox"],
    ["misspelled", "producton"],
  ])("uses the sandbox when SQUARE_ENV is %s", async (_label, squareEnv) => {
    const { options } = await loadClient({ squareEnv });

    expect(options?.environment).toBe(squareMocks.Sandbox);
  });

  it("uses production only for an exact match", async () => {
    const { options } = await loadClient({ squareEnv: "production" });

    expect(options?.environment).toBe(squareMocks.Production);
  });

  it("passes the access token and pinned API version through", async () => {
    const { options } = await loadClient({ accessToken: "token-abc" });

    expect(options).toMatchObject({
      token: "token-abc",
      version: "2025-10-16",
    });
  });
});

describe("required environment variables", () => {
  it("refuses to load without an access token", async () => {
    vi.resetModules();
    vi.stubEnv("SQUARE_ACCESS_TOKEN", undefined);

    await expect(import("./client")).rejects.toThrow(
      "Missing required environment variable: SQUARE_ACCESS_TOKEN"
    );
  });

  it("returns the configured location id", async () => {
    const { client } = await loadClient({ locationId: "location-1" });

    expect(client.getSquareLocationId()).toBe("location-1");
  });

  it("throws a named error when the location id is missing", async () => {
    const { client } = await loadClient({ locationId: undefined });

    expect(() => client.getSquareLocationId()).toThrow(
      "Missing required environment variable: NEXT_PUBLIC_SQUARE_LOCATION_ID"
    );
  });
});

describe("getSquareWebhookEndpoints", () => {
  const fallbackUrl = "https://request.example/api/square/webhook";

  it("signs against the incoming request URL when no notification URL is set", async () => {
    const { client } = await loadClient({ signatureKey: "key-1" });

    expect(client.getSquareWebhookEndpoints(fallbackUrl)).toEqual([
      { notificationUrl: fallbackUrl, signatureKey: "key-1" },
    ]);
  });

  // Square signs over the URL registered with the subscription, which is not
  // always the URL the request arrives on (proxies, alternate hostnames).
  it("prefers an explicitly registered notification URL", async () => {
    const { client } = await loadClient({
      signatureKey: "key-1",
      notificationUrl: "https://uxhub.example/api/square/webhook",
    });

    expect(client.getSquareWebhookEndpoints(fallbackUrl)).toEqual([
      {
        notificationUrl: "https://uxhub.example/api/square/webhook",
        signatureKey: "key-1",
      },
    ]);
  });

  it("reads every subscription from the multi-endpoint variable", async () => {
    const { client } = await loadClient({
      endpoints:
        "https://a.example/api/square/webhook|key-a,https://b.example/api/square/webhook|key-b",
    });

    expect(client.getSquareWebhookEndpoints(fallbackUrl)).toEqual([
      { notificationUrl: "https://a.example/api/square/webhook", signatureKey: "key-a" },
      { notificationUrl: "https://b.example/api/square/webhook", signatureKey: "key-b" },
    ]);
  });

  it("throws when no signing material is configured at all", async () => {
    const { client } = await loadClient();

    expect(() => client.getSquareWebhookEndpoints(fallbackUrl)).toThrow(
      "Missing required environment variable: SQUARE_WEBHOOK_SIGNATURE_KEY or SQUARE_WEBHOOK_ENDPOINTS"
    );
  });
});
