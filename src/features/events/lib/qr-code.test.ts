import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { type QrSvg, toQrSvg } from "./qr-code";

// The shape of `event_tickets.qr_token`: 16 random bytes as hex.
const QR_TOKEN = "9f86d081884c7d659a2feaa0c55ad015";
const OTHER_QR_TOKEN = "2c26b46b68ffc68ff99b453c1d304134";
const MODULE = /M(\d+) (\d+)h1v1h-1z/g;
const PIXELS_PER_MODULE = 4;

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
  it("scans back to the ticket's token", () => {
    expect(scan(toQrSvg(QR_TOKEN))).toBe(QR_TOKEN);
  });

  it("scans back to a link, for the scanner's open-on-your-phone code", () => {
    const url = "https://www.ubcuxhub.ca/admin/events/3f1c9a52-8d4e-4b7a-9c61-2e5f0d8b7a14/check-in/scan";

    expect(scan(toQrSvg(url))).toBe(url);
  });

  it("draws the same code every time, so a screenshot keeps working", () => {
    expect(toQrSvg(QR_TOKEN)).toEqual(toQrSvg(QR_TOKEN));
  });

  it("draws a different code for a different ticket", () => {
    expect(toQrSvg(OTHER_QR_TOKEN).path).not.toBe(toQrSvg(QR_TOKEN).path);
  });

  it("leaves a four-module quiet zone around the code", () => {
    const { size, path } = toQrSvg(QR_TOKEN);
    const coordinates = [...path.matchAll(MODULE)].flatMap(([, x, y]) => [
      Number(x),
      Number(y),
    ]);

    expect(path.replace(MODULE, "")).toBe("");
    expect(Math.min(...coordinates)).toBe(4);
    expect(Math.max(...coordinates)).toBe(size - 5);
  });
});
