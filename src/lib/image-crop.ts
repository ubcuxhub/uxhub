/**
 * Geometry for the image crop dialog (`ImageCropDialog`). Everything is
 * measured in "crop units", where the crop frame is 1 wide (and `1 / aspect`
 * tall), so the math doesn't depend on how many pixels the dialog's stage has.
 *
 * At zoom 1 the image just covers the frame; `offset` is how far the image's
 * centre sits from the frame's centre, in crop units on both axes.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

/** A region of the source image, in its own pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CROP_ZOOM_MIN = 1;
export const CROP_ZOOM_MAX = 3;
export const CROP_ZOOM_STEP = 0.05;
/** The uploaded avatar square, in pixels: twice the largest avatar on a 2x screen. */
export const CROP_OUTPUT_SIZE = 512;

export function clampZoom(zoom: number, max = CROP_ZOOM_MAX): number {
  if (!Number.isFinite(zoom)) return CROP_ZOOM_MIN;
  return Math.min(Math.max(CROP_ZOOM_MIN, max), Math.max(CROP_ZOOM_MIN, zoom));
}

/**
 * The frame at zoom 1, in source pixels: the largest `aspect` rectangle the
 * image holds.
 */
export function coverSize(natural: Size, aspect = 1): Size {
  const width = Math.min(natural.width, natural.height * aspect);
  return { width, height: width / aspect };
}

/** The image's displayed size in crop units. */
export function displayedSize(natural: Size, zoom: number, aspect = 1): Size {
  const frame = coverSize(natural, aspect).width;
  return {
    width: (natural.width / frame) * zoom,
    height: (natural.height / frame) * zoom,
  };
}

/** Pulls `offset` in so the image always covers the whole frame. */
export function clampOffset(
  offset: Offset,
  natural: Size,
  zoom: number,
  aspect = 1,
): Offset {
  const shown = displayedSize(natural, zoom, aspect);
  const maxX = Math.max(0, (shown.width - 1) / 2);
  const maxY = Math.max(0, (shown.height - 1 / aspect) / 2);
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(-max, value)) : 0;
  return { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) };
}

/**
 * Zooms about the frame's centre: the point of the image under the centre
 * stays there, then the offset is clamped for the new zoom.
 */
export function zoomAboutCentre(
  offset: Offset,
  natural: Size,
  from: number,
  to: number,
  aspect = 1,
): Offset {
  const ratio = from > 0 ? to / from : 1;
  return clampOffset({ x: offset.x * ratio, y: offset.y * ratio }, natural, to, aspect);
}

/**
 * The most the dialog may zoom in while the kept region stays at least
 * `min` source pixels: zooming further would upscale on export.
 */
export function maxZoomFor(natural: Size, aspect = 1, min?: Partial<Size>): number {
  const cover = coverSize(natural, aspect);
  const limit = Math.min(
    CROP_ZOOM_MAX,
    min?.width ? cover.width / min.width : CROP_ZOOM_MAX,
    min?.height ? cover.height / min.height : CROP_ZOOM_MAX,
  );
  return Math.max(CROP_ZOOM_MIN, limit);
}

/** The region of the source image, in its own pixels, that the crop keeps. */
export function cropSourceRect(
  natural: Size,
  zoom: number,
  offset: Offset,
  aspect = 1,
  maxZoom = CROP_ZOOM_MAX,
): Rect {
  const z = clampZoom(zoom, maxZoom);
  const clamped = clampOffset(offset, natural, z, aspect);
  const width = coverSize(natural, aspect).width / z;
  const height = width / aspect;
  return {
    x: natural.width / 2 - clamped.x * width - width / 2,
    y: natural.height / 2 - clamped.y * width - height / 2,
    width,
    height,
  };
}
