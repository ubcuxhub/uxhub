import { describe, expect, it } from "vitest";

import {
  buildEventImageObjectKey,
  describeFileType,
  describeImageRequirements,
  describeMinSize,
  describeWrongFileType,
  EVENT_IMAGE_ERRORS,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_EDGE,
  getImageDimensions,
  getJpegDimensions,
  getPngDimensions,
  needsEventImageOptimization,
  parseEventImageObjectKey,
  parseEventImageUpload,
  resolveEventImageType,
  resolveImagePreviewSrc,
  scaledImageSize,
} from "./event-image";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Builds the smallest PNG header the dimension parser accepts (24 bytes). */
function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from(PNG_SIGNATURE).copy(buffer, 0);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** Builds a minimal JPEG: SOI, then one SOF0 segment carrying the dimensions. */
function jpegWithSof(
  width: number,
  height: number,
  { marker = 0xc0, padMarker = false } = {}
): Buffer {
  const head = padMarker
    ? [0xff, 0xd8, 0xff, 0xff, marker]
    : [0xff, 0xd8, 0xff, marker];
  const segment = Buffer.alloc(9);
  segment.writeUInt16BE(9, 0); // segment length
  segment.writeUInt8(8, 2); // sample precision
  segment.writeUInt16BE(height, 3);
  segment.writeUInt16BE(width, 5);
  return Buffer.concat([Buffer.from(head), segment]);
}

function squarePng(size = 512) {
  return {
    fileType: "image/png",
    size: 1024,
    buffer: pngHeader(size, size),
  };
}

describe("resolveEventImageType", () => {
  it.each([
    ["image/png", "image/png", "png"],
    ["image/jpeg", "image/jpeg", "jpg"],
    ["image/jpg", "image/jpeg", "jpg"],
  ])("maps %s to %s/%s", (fileType, contentType, extension) => {
    expect(resolveEventImageType(fileType)).toEqual({
      contentType,
      extension,
    });
  });

  it.each(["image/gif", "image/webp", "application/pdf", "", "png"])(
    "rejects %s",
    (fileType) => {
      expect(() => resolveEventImageType(fileType)).toThrow(
        EVENT_IMAGE_ERRORS.type
      );
    }
  );
});

describe("getPngDimensions", () => {
  it("reads dimensions from a valid header", () => {
    expect(getPngDimensions(pngHeader(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("rejects a buffer shorter than 24 bytes", () => {
    expect(getPngDimensions(pngHeader(800, 600).subarray(0, 23))).toBeNull();
  });

  it("rejects a wrong signature", () => {
    const buffer = pngHeader(800, 600);
    buffer.writeUInt8(0x00, 0);
    expect(getPngDimensions(buffer)).toBeNull();
  });
});

describe("getJpegDimensions", () => {
  it("reads dimensions from an SOF0 segment", () => {
    expect(getJpegDimensions(jpegWithSof(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("skips a run of 0xff marker padding", () => {
    expect(getJpegDimensions(jpegWithSof(640, 480, { padMarker: true }))).toEqual(
      { width: 640, height: 480 }
    );
  });

  it.each([0xc1, 0xc2, 0xc3])(
    "reads dimensions from SOF marker 0x%s",
    (marker) => {
      expect(getJpegDimensions(jpegWithSof(320, 320, { marker }))).toEqual({
        width: 320,
        height: 320,
      });
    }
  );

  it("returns null when the stream is not a JPEG", () => {
    expect(getJpegDimensions(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("returns null on a buffer shorter than 4 bytes", () => {
    expect(getJpegDimensions(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("stops at start-of-scan without finding dimensions", () => {
    expect(getJpegDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xda]))).toBeNull();
  });

  it("stops at end-of-image without finding dimensions", () => {
    expect(getJpegDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });

  it("bails out on a segment length below 2", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x01, 0x00]);
    expect(getJpegDimensions(buffer)).toBeNull();
  });

  it("bails out when a segment length overruns the buffer", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0xff, 0xff, 0x00]);
    expect(getJpegDimensions(buffer)).toBeNull();
  });
});

describe("getImageDimensions", () => {
  it("dispatches png to the png parser", () => {
    expect(getImageDimensions(pngHeader(256, 256), "image/png")).toEqual({
      width: 256,
      height: 256,
    });
  });

  it.each(["image/jpeg", "image/jpg"])("dispatches %s to the jpeg parser", (type) => {
    expect(getImageDimensions(jpegWithSof(256, 256), type)).toEqual({
      width: 256,
      height: 256,
    });
  });

  it("returns null for an unsupported type", () => {
    expect(getImageDimensions(pngHeader(256, 256), "image/gif")).toBeNull();
  });
});

describe("parseEventImageUpload", () => {
  it("accepts a square png", () => {
    expect(parseEventImageUpload(squarePng())).toEqual({
      contentType: "image/png",
      extension: "png",
      dimensions: { width: 512, height: 512 },
    });
  });

  it("normalizes image/jpg to image/jpeg", () => {
    expect(
      parseEventImageUpload({
        fileType: "image/jpg",
        size: 1024,
        buffer: jpegWithSof(300, 300),
      })
    ).toMatchObject({ contentType: "image/jpeg", extension: "jpg" });
  });

  it("rejects a disallowed type", () => {
    expect(() =>
      parseEventImageUpload({ ...squarePng(), fileType: "image/gif" })
    ).toThrow(EVENT_IMAGE_ERRORS.type);
  });

  it("rejects an oversize reported size", () => {
    expect(() =>
      parseEventImageUpload({ ...squarePng(), size: EVENT_IMAGE_MAX_BYTES + 1 })
    ).toThrow(EVENT_IMAGE_ERRORS.size);
  });

  it("rejects an oversize buffer even when the reported size is small", () => {
    expect(() =>
      parseEventImageUpload({
        fileType: "image/png",
        size: 10,
        buffer: Buffer.concat([
          pngHeader(512, 512),
          Buffer.alloc(EVENT_IMAGE_MAX_BYTES),
        ]),
      })
    ).toThrow(EVENT_IMAGE_ERRORS.size);
  });

  it("rejects an unreadable image", () => {
    expect(() =>
      parseEventImageUpload({
        fileType: "image/png",
        size: 10,
        buffer: Buffer.from([0x00, 0x01]),
      })
    ).toThrow(EVENT_IMAGE_ERRORS.dimensions);
  });

  it("rejects a non-square image", () => {
    expect(() =>
      parseEventImageUpload({ ...squarePng(), buffer: pngHeader(800, 600) })
    ).toThrow(EVENT_IMAGE_ERRORS.square);
  });
});

describe("buildEventImageObjectKey", () => {
  it("slugifies the event name and appends the unique id", () => {
    expect(buildEventImageObjectKey("UXathon 2026!", "png", "abc-123")).toBe(
      "covers/uxathon-2026-abc-123.png"
    );
  });

  it("truncates a long name to 50 characters without a trailing hyphen", () => {
    const key = buildEventImageObjectKey("a".repeat(80), "jpg", "id");
    expect(key).toBe(`covers/${"a".repeat(50)}-id.jpg`);
  });

  it("trims a hyphen exposed by truncation", () => {
    const name = `${"a".repeat(50)} tail`;
    expect(buildEventImageObjectKey(name, "jpg", "id")).toBe(
      `covers/${"a".repeat(50)}-id.jpg`
    );
  });

  it.each(["", "   ", "🎉🎉"])(
    "falls back to the slugify default for %s",
    (name) => {
      expect(buildEventImageObjectKey(name, "png", "id")).toBe(
        "covers/item-id.png"
      );
    }
  );
});

describe("parseEventImageObjectKey", () => {
  it.each([
    [
      "hosted",
      "https://otsvpvnoqwlenghobdal.supabase.co/storage/v1/object/public/event-images/covers/a-1.png",
    ],
    [
      "local",
      "http://127.0.0.1:54321/storage/v1/object/public/event-images/covers/a-1.png",
    ],
  ])("extracts the key from a %s url", (_label, url) => {
    expect(parseEventImageObjectKey(url, "event-images")).toBe("covers/a-1.png");
  });

  it("decodes percent-encoded keys", () => {
    expect(
      parseEventImageObjectKey(
        "https://x.supabase.co/storage/v1/object/public/event-images/covers/a%20b.png",
        "event-images"
      )
    ).toBe("covers/a b.png");
  });

  it("rejects a different bucket", () => {
    expect(
      parseEventImageObjectKey(
        "https://x.supabase.co/storage/v1/object/public/avatars/covers/a-1.png",
        "event-images"
      )
    ).toBeNull();
  });

  it.each([
    ["a legacy relative path", "/event_images/a-cover.jpg"],
    ["a non-storage url", "https://images.unsplash.com/photo-123"],
    ["a signed storage url", "https://x.supabase.co/storage/v1/object/sign/event-images/a.png"],
    ["an empty key", "https://x.supabase.co/storage/v1/object/public/event-images/"],
    ["a malformed url", "not-a-url"],
    ["an empty string", ""],
  ])("returns null for %s", (_label, url) => {
    expect(parseEventImageObjectKey(url, "event-images")).toBeNull();
  });
});

describe("resolveImagePreviewSrc", () => {
  it.each([
    ["https://x.supabase.co/storage/v1/object/public/event-images/a.png"],
    ["http://127.0.0.1:54321/storage/v1/object/public/event-images/a.png"],
    ["data:image/png;base64,AAAA"],
    ["blob:http://localhost:3000/abc"],
  ])("passes %s through unchanged", (value) => {
    expect(resolveImagePreviewSrc(value)).toBe(value);
  });

  it("preserves a leading slash on a legacy path", () => {
    expect(resolveImagePreviewSrc("/event_images/a-cover.jpg")).toBe(
      "/event_images/a-cover.jpg"
    );
  });

  it("prefixes a bare relative path", () => {
    expect(resolveImagePreviewSrc("event_images/a-cover.jpg")).toBe(
      "/event_images/a-cover.jpg"
    );
  });
});

describe("describeFileType", () => {
  it("names the types worth naming", () => {
    expect(describeFileType("image/gif")).toBe("GIF");
    expect(describeFileType("image/webp")).toBe("WebP");
    expect(describeFileType("application/pdf")).toBe("PDF");
  });

  it("ignores case and returns null for anything else", () => {
    expect(describeFileType("IMAGE/GIF")).toBe("GIF");
    expect(describeFileType("")).toBeNull();
    expect(describeFileType("application/x-unknown")).toBeNull();
  });
});

describe("describeWrongFileType", () => {
  it("names the file's type and says what to upload", () => {
    expect(describeWrongFileType("image/gif")).toBe(
      "That file is a GIF. Upload a JPG or PNG."
    );
  });

  it("uses an for a vowel sound", () => {
    expect(describeWrongFileType("image/svg+xml")).toBe(
      "That file is an SVG. Upload a JPG or PNG."
    );
  });

  it("falls back when the type is unknown", () => {
    expect(describeWrongFileType("")).toBe(
      "That file isn\u2019t a JPG or PNG. Upload a JPG or PNG."
    );
  });
});

describe("describeMinSize", () => {
  it("states the smallest accepted size", () => {
    expect(describeMinSize(1600, 400)).toBe(
      "Image must be at least 1600 \u00d7 400 px."
    );
  });
});

describe("describeImageRequirements", () => {
  it("defaults to any JPG or PNG within the size limit", () => {
    expect(describeImageRequirements()).toBe("JPG or PNG, up to 20 MB");
  });

  it("says square", () => {
    expect(describeImageRequirements({ square: true })).toBe(
      "Square JPG or PNG, up to 20 MB"
    );
  });

  it("adds a minimum size", () => {
    expect(
      describeImageRequirements({ minWidth: 1600, minHeight: 400 })
    ).toBe("JPG or PNG, 1600 \u00d7 400 px or larger, up to 20 MB");
    expect(
      describeImageRequirements({ square: true, minWidth: 600, minHeight: 600 })
    ).toBe("Square JPG or PNG, 600 \u00d7 600 px or larger, up to 20 MB");
  });
});


describe("separate event image kinds", () => {
  it("accepts rectangular headers without weakening icon checks", () => {
    const image = { fileType: "image/png", size: 100, buffer: pngHeader(1600, 400) };
    expect(parseEventImageUpload({ ...image, kind: "header" }).dimensions).toEqual({ width: 1600, height: 400 });
    expect(() => parseEventImageUpload({ ...image, kind: "icon" })).toThrow(/square/);
  });
  it.each([["header", 1599, 400], ["header", 1600, 399], ["icon", 599, 599]] as const)("enforces %s minimum dimensions", (kind, width, height) => {
    expect(() => parseEventImageUpload({ kind, fileType: "image/png", size: 100, buffer: pngHeader(width, height) })).toThrow(/at least/);
  });
});


it("accepts nonsquare entry logos without cover/header minimums while retaining file safety", () => {
  expect(parseEventImageUpload({ kind: "entry", fileType: "image/png", size: 100, buffer: pngHeader(120, 48) }).dimensions).toEqual({ width: 120, height: 48 });
  expect(() => parseEventImageUpload({ kind: "entry", fileType: "image/svg+xml", size: 100, buffer: pngHeader(120, 48) })).toThrow();
});

describe("needsEventImageOptimization", () => {
  it("leaves a file that fits and is drawn at full size", () => {
    expect(needsEventImageOptimization(EVENT_IMAGE_MAX_BYTES, { width: EVENT_IMAGE_MAX_EDGE, height: 600 })).toBe(false);
  });

  it("shrinks a file over the upload limit", () => {
    expect(needsEventImageOptimization(EVENT_IMAGE_MAX_BYTES + 1, { width: 1600, height: 400 })).toBe(true);
  });

  it("shrinks an image larger than any page draws it", () => {
    expect(needsEventImageOptimization(1000, { width: 600, height: EVENT_IMAGE_MAX_EDGE + 1 })).toBe(true);
  });
});

describe("scaledImageSize", () => {
  it("brings the longest edge down to the maximum, keeping the ratio", () => {
    expect(scaledImageSize({ width: 6000, height: 1500 })).toEqual({ width: 2560, height: 640 });
    expect(scaledImageSize({ width: 3000, height: 4000 })).toEqual({ width: 1920, height: 2560 });
  });

  it("never upscales", () => {
    expect(scaledImageSize({ width: 1800, height: 450 })).toEqual({ width: 1800, height: 450 });
  });

  it("applies a further shrink factor", () => {
    expect(scaledImageSize({ width: 5120, height: 2560 }, {}, 0.8)).toEqual({ width: 2048, height: 1024 });
  });

  it("stops at the minimum size", () => {
    expect(scaledImageSize({ width: 6400, height: 1600 }, { minWidth: 1600, minHeight: 400 }, 0.1)).toEqual({ width: 1600, height: 400 });
    // A very wide banner reaches the minimum height first.
    expect(scaledImageSize({ width: 12000, height: 1000 }, { minWidth: 1600, minHeight: 400 }, 0.64)).toEqual({ width: 4800, height: 400 });
    expect(scaledImageSize({ width: 4000, height: 4000 }, { minWidth: 600, minHeight: 600 }, 0.1)).toEqual({ width: 600, height: 600 });
  });
});
