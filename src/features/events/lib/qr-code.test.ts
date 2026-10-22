import jsQR from "jsqr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckInToken, verifyCheckInToken } from "@/lib/check-in-token";

import { type QrSvg, toQrSvg } from "./qr-code";

vi.mock("server-only", () => ({}));

const REGISTRATION_ID = "3f1c9a52-8d4e-4b7a-9c61-2e5f0d8b7a14";
const OTHER_REGISTRATION_ID = "a7e2b310-5c9d-4f68-8b23-91d4c6e0f257";
const MODULE = /M(\d+) (\d+)h1v1h-1z/g;
const PIXELS_PER_MODULE = 4;

beforeEach(() => {
  vi.stubEnv(
    "CHECK_IN_TOKEN_SECRET",
    "test-secret-that-is-at-least-32-characters-long",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Paints the code onto a white bitmap and reads it back the way a scanner would. */
function scan({ size, path }: QrSvg): string | undefined {
  const width = size * PIXELS_PER_MODULE;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const [, x, y] of path.matchAll(MODULE)) {
    for (let dy = 0; dy < PIXELS_PER_MODULE; dy++) {
      for (let dx = 0; dx < PIXELS_PER_MODULE; dx++) {
        const px = Number(x) * PIXELS_PER_MODULE + dx;
        const py = Number(y) * PIXELS_PER_MODULE + dy;
        pixels.fill(0, (py * width + px) * 4, (py * width + px) * 4 + 3);
      }
    }
  }
  return jsQR(pixels, width, width)?.data;
}

describe("toQrSvg", () => {
  it("scans back to a check-in token for the same registration", () => {
    const token = createCheckInToken(REGISTRATION_ID);

    const scanned = scan(toQrSvg(token));

    expect(scanned).toBe(token);
    expect(verifyCheckInToken(scanned ?? "")).toBe(REGISTRATION_ID);
  });

  it("draws the same code every time, so a screenshot keeps working", () => {
    const first = toQrSvg(createCheckInToken(REGISTRATION_ID));
    const second = toQrSvg(createCheckInToken(REGISTRATION_ID));

    expect(second).toEqual(first);
  });

  it("draws a different code for a different registration", () => {
    const first = toQrSvg(createCheckInToken(REGISTRATION_ID));
    const other = toQrSvg(createCheckInToken(OTHER_REGISTRATION_ID));

    expect(other.path).not.toBe(first.path);
  });

  it("leaves a four-module quiet zone around the code", () => {
    const { size, path } = toQrSvg(createCheckInToken(REGISTRATION_ID));
    const coordinates = [...path.matchAll(MODULE)].flatMap(([, x, y]) => [
      Number(x),
      Number(y),
    ]);

    expect(path.replace(MODULE, "")).toBe("");
    expect(Math.min(...coordinates)).toBe(4);
    expect(Math.max(...coordinates)).toBe(size - 5);
  });
});
