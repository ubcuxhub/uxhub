import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckInToken, verifyCheckInToken } from "./check-in-token";

vi.mock("server-only", () => ({}));

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const TICKET_ID = "3f1c9a52-8d4e-4b7a-9c61-2e5f0d8b7a14";
const OTHER_TICKET_ID = "a7e2b310-5c9d-4f68-8b23-91d4c6e0f257";

beforeEach(() => {
  vi.stubEnv("CHECK_IN_TOKEN_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function replaceCharAt(value: string, index: number) {
  const replacement = value[index] === "A" ? "B" : "A";
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

describe("a real token", () => {
  it("verifies back to the ticket it was issued for", () => {
    const token = createCheckInToken(TICKET_ID);

    expect(verifyCheckInToken(token)).toBe(TICKET_ID);
  });

  // A screenshot of the ticket has to keep working, so the token for a
  // ticket can never change between page loads.
  it("is the same every time it is issued", () => {
    expect(createCheckInToken(TICKET_ID)).toBe(
      createCheckInToken(TICKET_ID)
    );
  });

  it("starts with the ticket ID", () => {
    expect(createCheckInToken(TICKET_ID)).toMatch(
      new RegExp(`^${TICKET_ID}\\.[A-Za-z0-9_-]+$`)
    );
  });

  it("verifies when issued from an uppercase ID", () => {
    const token = createCheckInToken(TICKET_ID.toUpperCase());

    expect(verifyCheckInToken(token)).toBe(TICKET_ID);
  });

  it("tolerates the trailing newline some scanners append", () => {
    const token = createCheckInToken(TICKET_ID);

    expect(verifyCheckInToken(`${token}\n`)).toBe(TICKET_ID);
  });
});

describe("an edited token", () => {
  it("fails when a character of the signature changes", () => {
    const token = createCheckInToken(TICKET_ID);
    const signatureStart = token.indexOf(".") + 1;

    expect(verifyCheckInToken(replaceCharAt(token, signatureStart))).toBeNull();
  });

  // The last base64url character of a 16-byte signature carries padding bits,
  // so changing it can leave the decoded bytes untouched.
  it("fails when only the last character of the signature changes", () => {
    const token = createCheckInToken(TICKET_ID);

    expect(
      verifyCheckInToken(replaceCharAt(token, token.length - 1))
    ).toBeNull();
  });

  it("fails when the ID is swapped for another ticket's", () => {
    const signature = createCheckInToken(TICKET_ID).split(".")[1];

    expect(
      verifyCheckInToken(`${OTHER_TICKET_ID}.${signature}`)
    ).toBeNull();
  });

  it("fails when the signature is truncated or extended", () => {
    const token = createCheckInToken(TICKET_ID);

    expect(verifyCheckInToken(token.slice(0, -1))).toBeNull();
    expect(verifyCheckInToken(`${token}A`)).toBeNull();
  });
});

describe("a made-up token", () => {
  it("fails with a bare ticket ID", () => {
    expect(verifyCheckInToken(TICKET_ID)).toBeNull();
  });

  it("fails with a guessed signature", () => {
    expect(
      verifyCheckInToken(`${TICKET_ID}.AAAAAAAAAAAAAAAAAAAAAA`)
    ).toBeNull();
  });

  it("fails when signed with a different secret", () => {
    vi.stubEnv("CHECK_IN_TOKEN_SECRET", "a-different-secret-also-32-characters-long");
    const forged = createCheckInToken(TICKET_ID);
    vi.stubEnv("CHECK_IN_TOKEN_SECRET", SECRET);

    expect(verifyCheckInToken(forged)).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["an unrelated URL", "https://example.com/menu"],
    ["too many segments", `${TICKET_ID}.abc.def`],
    ["a non-UUID ID", "not-a-ticket.AAAAAAAAAAAAAAAAAAAAAA"],
  ])("fails for %s", (_label, token) => {
    expect(verifyCheckInToken(token)).toBeNull();
  });
});

describe("configuration", () => {
  it("refuses to issue a token for something other than a ticket ID", () => {
    expect(() => createCheckInToken("not-a-uuid")).toThrow(
      "A check-in token can only be issued for a ticket ID."
    );
  });

  // A missing secret is a deploy mistake; it must not read as "invalid ticket"
  // for every attendee at the door.
  it("throws when the secret is missing", () => {
    vi.stubEnv("CHECK_IN_TOKEN_SECRET", undefined);

    expect(() => createCheckInToken(TICKET_ID)).toThrow(
      "Missing required environment variable: CHECK_IN_TOKEN_SECRET"
    );
    expect(() => verifyCheckInToken("anything")).toThrow(
      "Missing required environment variable: CHECK_IN_TOKEN_SECRET"
    );
  });

  it("throws when the secret is too short to be safe", () => {
    vi.stubEnv("CHECK_IN_TOKEN_SECRET", "short");

    expect(() => createCheckInToken(TICKET_ID)).toThrow(
      "CHECK_IN_TOKEN_SECRET must be at least 32 characters."
    );
  });
});
