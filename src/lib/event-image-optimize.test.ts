import { describe, expect, it, vi } from "vitest";

import { fitUnderLimit, renameForType, type ImageEncoder } from "./event-image-optimize";

/** A fake encoder whose output size is pixels x bytes-per-pixel for its type and quality. */
function encoder(bytesPerPixel: (type: string, quality?: number) => number) {
  return vi.fn<ImageEncoder>(async (size, type, quality) => {
    const bytes = Math.round(size.width * size.height * bytesPerPixel(type, quality));
    return new Blob([new Uint8Array(bytes)], { type });
  });
}

describe("fitUnderLimit", () => {
  const source = { width: 6000, height: 1500 };

  it("returns the first encoding that fits, at the maximum edge", async () => {
    const encode = encoder(() => 0.5);
    const blob = await fitUnderLimit(source, encode, { preferPng: false, maxBytes: 1_000_000 });
    expect(blob?.type).toBe("image/jpeg");
    expect(encode).toHaveBeenCalledOnce();
    expect(encode).toHaveBeenCalledWith({ width: 2560, height: 640 }, "image/jpeg", 0.85);
  });

  it("keeps a PNG as PNG when it fits", async () => {
    const encode = encoder(() => 0.5);
    const blob = await fitUnderLimit(source, encode, { preferPng: true, maxBytes: 1_000_000 });
    expect(blob?.type).toBe("image/png");
  });

  it("falls back from PNG to JPEG, lowering quality before size", async () => {
    // PNG never fits; JPEG fits only at quality 0.65.
    const encode = encoder((type, quality) => (type === "image/png" ? 10 : quality === 0.65 ? 0.5 : 2));
    const blob = await fitUnderLimit(source, encode, { preferPng: true, maxBytes: 1_000_000 });
    expect(blob?.type).toBe("image/jpeg");
    const calls = encode.mock.calls.map(([size, type, quality]) => [size.width, type, quality]);
    // The first PNG shows the smaller ones can't fit either, so they're skipped.
    expect(calls).toEqual([
      [2560, "image/png", undefined],
      [2560, "image/jpeg", 0.85],
      [2560, "image/jpeg", 0.75],
      [2560, "image/jpeg", 0.65],
    ]);
  });

  it("never shrinks below the minimum, trying each size once", async () => {
    const encode = encoder(() => 100);
    const blob = await fitUnderLimit({ width: 1700, height: 425 }, encode, {
      preferPng: false,
      minWidth: 1600,
      minHeight: 400,
      maxBytes: 1,
    });
    expect(blob).toBeNull();
    const widths = new Set(encode.mock.calls.map(([size]) => size.width));
    // 1700 at full size, then the 0.8 and 0.64 shrinks both clamp to 1600.
    expect([...widths]).toEqual([1700, 1600]);
    expect(encode).toHaveBeenCalledTimes(6);
  });

  it("tries a smaller PNG when the first one was close", async () => {
    // 2560 x 640 at 1 byte/px is 1.6 MB; 2048 x 512 is about 1 MB.
    const encode = encoder((type) => (type === "image/png" ? 1 : 10));
    const blob = await fitUnderLimit(source, encode, { preferPng: true, maxBytes: 1_100_000 });
    expect(blob?.type).toBe("image/png");
    expect(encode.mock.calls.map(([size]) => size.width)).toEqual([2560, 2048]);
  });
});

describe("renameForType", () => {
  it("swaps the extension for the encoded type", () => {
    expect(renameForType("Banner.final.PNG", "image/jpeg")).toBe("Banner.final.jpg");
    expect(renameForType("logo.png", "image/png")).toBe("logo.png");
    expect(renameForType("no-extension", "image/jpeg")).toBe("no-extension.jpg");
    expect(renameForType(".png", "image/jpeg")).toBe("image.jpg");
  });
});
