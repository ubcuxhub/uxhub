/**
 * Shrinks an event image in the browser before it is uploaded. The upload
 * route can't do this: Vercel rejects a request body over 4.5 MB before the
 * handler runs, so a file has to leave the browser under
 * `EVENT_IMAGE_MAX_BYTES` already.
 *
 * Browser-only (canvas, object URLs); `ImageUpload` is its one caller.
 */

import {
  EVENT_IMAGE_MAX_BYTES,
  scaledImageSize,
  type ImageDimensions,
} from "@/lib/event-image";
import type { Rect } from "@/lib/image-crop";

export type EncodedImageType = "image/jpeg" | "image/png";

/** Draws the decoded source at `size` and encodes it. */
export type ImageEncoder = (
  size: ImageDimensions,
  type: EncodedImageType,
  quality?: number,
) => Promise<Blob>;

export interface FitOptions {
  /** Try PNG before JPEG, so a PNG's transparency survives when it fits. */
  preferPng: boolean;
  minWidth?: number;
  minHeight?: number;
  maxBytes?: number;
}

const JPEG_QUALITIES = [0.85, 0.75, 0.65];
/** Further scale factors once the longest edge is at its maximum. */
const SHRINK_STEPS = [1, 0.8, 0.64];

/**
 * Encodes `source` until a result fits in `maxBytes`, or returns null when
 * none does. PNG goes first when preferred (at each size, since PNG has no
 * quality knob), then JPEG at falling quality and size. A size the minimum
 * clamps to more than once is tried once, and a smaller PNG is skipped when
 * the first one's bytes per pixel say it can't fit: PNG encodes are slow.
 */
export async function fitUnderLimit(
  source: ImageDimensions,
  encode: ImageEncoder,
  {
    preferPng,
    minWidth,
    minHeight,
    maxBytes = EVENT_IMAGE_MAX_BYTES,
  }: FitOptions,
): Promise<Blob | null> {
  const sizes: ImageDimensions[] = [];
  for (const shrink of SHRINK_STEPS) {
    const size = scaledImageSize(source, { minWidth, minHeight }, shrink);
    if (!sizes.some((s) => s.width === size.width && s.height === size.height)) {
      sizes.push(size);
    }
  }

  if (preferPng) {
    let bytesPerPixel = 0;
    for (const size of sizes) {
      const pixels = size.width * size.height;
      if (bytesPerPixel * pixels > maxBytes) continue;
      const png = await encode(size, "image/png");
      if (png.size <= maxBytes) return png;
      bytesPerPixel = png.size / pixels;
    }
  }

  for (const size of sizes) {
    for (const quality of JPEG_QUALITIES) {
      const jpeg = await encode(size, "image/jpeg", quality);
      if (jpeg.size <= maxBytes) return jpeg;
    }
  }

  return null;
}

/** "Banner.final.PNG" -> "Banner.final.jpg" */
export function renameForType(name: string, type: EncodedImageType): string {
  const base = name.replace(/\.[^./]+$/, "") || "image";
  return `${base}.${type === "image/png" ? "png" : "jpg"}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to decode image"));
    };
    image.src = url;
  });
}

/**
 * Draws `region` of the image. Browsers draw an `<img>` upright from its EXIF
 * orientation, so a phone photo comes out the way it looks in the preview.
 */
function canvasEncoder(image: HTMLImageElement, region: Rect): ImageEncoder {
  return (size, type, quality) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      // JPEG has no transparency: transparent pixels would turn black.
      if (type === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
      }
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        size.width,
        size.height,
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
        type,
        quality,
      );
    });
}

/**
 * Returns `file` cropped to `crop` (when given), scaled down and re-encoded to
 * fit the upload limit, or null when it can't be made to fit. An uncropped
 * file already under the limit comes back unchanged if re-encoding wouldn't
 * make it smaller.
 */
export async function optimizeEventImage(
  file: File,
  dimensions: ImageDimensions,
  {
    minWidth,
    minHeight,
    crop,
  }: { minWidth?: number; minHeight?: number; crop?: Rect } = {},
): Promise<File | null> {
  const image = await loadImage(file);
  const region = crop ?? { x: 0, y: 0, ...dimensions };
  const blob = await fitUnderLimit(
    { width: region.width, height: region.height },
    canvasEncoder(image, region),
    { preferPng: file.type === "image/png", minWidth, minHeight },
  );

  if (!blob) return null;
  if (!crop && file.size <= EVENT_IMAGE_MAX_BYTES && blob.size >= file.size) {
    return file;
  }

  const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
  return new File([blob], renameForType(file.name, type), {
    type,
    lastModified: file.lastModified,
  });
}
