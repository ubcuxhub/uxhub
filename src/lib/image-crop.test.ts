import { describe, expect, it } from "vitest";

import {
  clampOffset,
  clampZoom,
  CROP_ZOOM_MAX,
  cropSourceRect,
  coverSize,
  displayedSize,
  maxZoomFor,
  zoomAboutCentre,
} from "./image-crop";

const landscape = { width: 1200, height: 800 };
const square = { width: 500, height: 500 };

describe("photo crop geometry", () => {
  it("covers the crop square with the shorter side at zoom 1", () => {
    expect(displayedSize(landscape, 1)).toEqual({ width: 1.5, height: 1 });
    expect(displayedSize(square, 2)).toEqual({ width: 2, height: 2 });
  });

  it("keeps the zoom in range", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(99)).toBe(CROP_ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("never lets the photo uncover the crop square", () => {
    // A 1.5-wide photo can move a quarter either way, and not at all vertically.
    expect(clampOffset({ x: 1, y: 1 }, landscape, 1)).toEqual({ x: 0.25, y: 0 });
    expect(clampOffset({ x: -1, y: 0 }, landscape, 1)).toEqual({ x: -0.25, y: 0 });
    expect(clampOffset({ x: 0.1, y: -0.1 }, square, 2)).toEqual({ x: 0.1, y: -0.1 });
  });

  it("zooms about the centre, then re-clamps", () => {
    expect(zoomAboutCentre({ x: 0.2, y: 0 }, landscape, 1, 2)).toEqual({ x: 0.4, y: 0 });
    // Zooming back out pulls an edge-hugging offset in.
    expect(zoomAboutCentre({ x: 1, y: 0.5 }, square, 3, 1)).toEqual({ x: 0, y: 0 });
  });

  it("maps the crop back to source pixels", () => {
    expect(cropSourceRect(landscape, 1, { x: 0, y: 0 })).toEqual({ x: 200, y: 0, width: 800, height: 800 });
    // Photo moved right by a quarter: the crop shows its left edge.
    expect(cropSourceRect(landscape, 1, { x: 0.25, y: 0 })).toEqual({ x: 0, y: 0, width: 800, height: 800 });
    // Zoomed 2x on a square: the middle half.
    expect(cropSourceRect(square, 2, { x: 0, y: 0 })).toEqual({ x: 125, y: 125, width: 250, height: 250 });
  });
});

describe("wide crop frames", () => {
  // A 4:1 header frame over a 3000 x 2000 photo.
  const photo = { width: 3000, height: 2000 };

  it("covers the frame with the image's full width", () => {
    expect(coverSize(photo, 4)).toEqual({ width: 3000, height: 750 });
    // A very wide image is limited by its height instead.
    expect(coverSize({ width: 6000, height: 1000 }, 4)).toEqual({ width: 4000, height: 1000 });
    expect(displayedSize(photo, 1, 4)).toEqual({ width: 1, height: 2000 / 3000 });
  });

  it("only moves vertically when the image is taller than the frame", () => {
    const offset = clampOffset({ x: 1, y: 1 }, photo, 1, 4);
    expect(offset.x).toBe(0);
    // (2/3 - 1/4) / 2 of a frame width either way.
    expect(offset.y).toBeCloseTo((2 / 3 - 0.25) / 2);
  });

  it("maps the crop back to source pixels", () => {
    expect(cropSourceRect(photo, 1, { x: 0, y: 0 }, 4)).toEqual({ x: 0, y: 625, width: 3000, height: 750 });
    // Image moved all the way down: the frame shows its top.
    const top = cropSourceRect(photo, 1, { x: 0, y: 1 }, 4);
    expect(top.y).toBeCloseTo(0);
    expect(cropSourceRect(photo, 2, { x: 0, y: 0 }, 4)).toEqual({ x: 750, y: 812.5, width: 1500, height: 375 });
  });

  it("caps the zoom so the kept region stays above a minimum size", () => {
    expect(maxZoomFor(photo, 4, { width: 1600, height: 400 })).toBeCloseTo(3000 / 1600);
    expect(maxZoomFor({ width: 1600, height: 400 }, 4, { width: 1600, height: 400 })).toBe(1);
    expect(maxZoomFor({ width: 9000, height: 9000 }, 1, { width: 600, height: 600 })).toBe(CROP_ZOOM_MAX);
    expect(cropSourceRect(photo, 3, { x: 0, y: 0 }, 4, maxZoomFor(photo, 4, { width: 1600, height: 400 })).width).toBeCloseTo(1600);
  });
});
