/**
 * Geometry for the photo crop dialog. Everything is measured in "crop units",
 * where the crop square (the circle's bounding box) is 1 wide, so the math
 * doesn't depend on how many pixels the dialog's stage has.
 *
 * At zoom 1 the photo's shorter side exactly fills the crop square (cover);
 * `offset` is how far the photo's centre sits from the crop square's centre.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 3;
export const CROP_ZOOM_STEP = 0.05;
/** The uploaded square, in pixels: twice the largest avatar on a 2x screen. */
export const CROP_OUTPUT_SIZE = 512;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return CROP_ZOOM_MIN;
  return Math.min(CROP_ZOOM_MAX, Math.max(CROP_ZOOM_MIN, zoom));
}

/** The photo's displayed size in crop units. */
export function displayedSize(natural: Size, zoom: number): Size {
  const shorter = Math.min(natural.width, natural.height);
  return {
    width: (natural.width / shorter) * zoom,
    height: (natural.height / shorter) * zoom,
  };
}

/** Pulls `offset` in so the photo always covers the whole crop square. */
export function clampOffset(offset: Offset, natural: Size, zoom: number): Offset {
  const shown = displayedSize(natural, zoom);
  const maxX = Math.max(0, (shown.width - 1) / 2);
  const maxY = Math.max(0, (shown.height - 1) / 2);
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(-max, value)) : 0;
  return { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) };
}

/**
 * Zooms about the crop square's centre: the point of the photo under the
 * centre stays there, then the offset is clamped for the new zoom.
 */
export function zoomAboutCentre(
  offset: Offset,
  natural: Size,
  from: number,
  to: number,
): Offset {
  const ratio = from > 0 ? to / from : 1;
  return clampOffset({ x: offset.x * ratio, y: offset.y * ratio }, natural, to);
}

/** The square of the source image, in its own pixels, that the crop keeps. */
export function cropSourceRect(natural: Size, zoom: number, offset: Offset) {
  const z = clampZoom(zoom);
  const clamped = clampOffset(offset, natural, z);
  const side = Math.min(natural.width, natural.height) / z;
  return {
    x: natural.width / 2 - clamped.x * side - side / 2,
    y: natural.height / 2 - clamped.y * side - side / 2,
    size: side,
  };
}
